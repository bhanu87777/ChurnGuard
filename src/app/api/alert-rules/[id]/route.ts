import { NextResponse } from "next/server";
import { Prisma, RuleConditionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateRuleParams } from "@/lib/rules";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/alert-rules/:id — edit or enable/disable.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await prisma.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    enabled?: boolean;
    conditionType?: RuleConditionType;
    params?: Prisma.InputJsonValue;
    notifyInApp?: boolean;
    notifyEmail?: boolean;
    cooldownHours?: number;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.notifyInApp !== undefined) data.notifyInApp = Boolean(body.notifyInApp);
  if (body.notifyEmail !== undefined) data.notifyEmail = Boolean(body.notifyEmail);
  if (body.cooldownHours !== undefined) {
    const h = Number(body.cooldownHours);
    if (!Number.isInteger(h) || h < 1 || h > 720) {
      return NextResponse.json(
        { error: "cooldownHours must be 1-720" },
        { status: 400 },
      );
    }
    data.cooldownHours = h;
  }

  // Condition type/params validate together against the effective type.
  const conditionType: RuleConditionType =
    body.conditionType !== undefined ? body.conditionType : existing.conditionType;
  if (!Object.values(RuleConditionType).includes(conditionType)) {
    return NextResponse.json({ error: "invalid conditionType" }, { status: 400 });
  }
  if (body.conditionType !== undefined || body.params !== undefined) {
    try {
      data.conditionType = conditionType;
      data.params = validateRuleParams(
        conditionType,
        body.params !== undefined ? body.params : existing.params,
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid params" },
        { status: 400 },
      );
    }
  }

  const rule = await prisma.alertRule.update({ where: { id }, data });

  await audit(auth.user, "rule.update", { type: "AlertRule", id }, {
    changed: Object.keys(data),
  });
  return NextResponse.json(rule);
}

// DELETE /api/alert-rules/:id
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const rule = await prisma.alertRule.delete({ where: { id } }).catch(() => null);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "rule.delete", { type: "AlertRule", id }, {
    name: rule.name,
  });
  return NextResponse.json({ ok: true });
}
