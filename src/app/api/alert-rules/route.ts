import { NextResponse } from "next/server";
import { RuleConditionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateRuleParams } from "@/lib/rules";

// GET /api/alert-rules — all rules.
export async function GET() {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const rules = await prisma.alertRule.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { notifications: true } } },
  });
  return NextResponse.json(rules);
}

// POST /api/alert-rules — create a rule (admin only).
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "name is required (max 80 chars)" },
      { status: 400 },
    );
  }
  if (!Object.values(RuleConditionType).includes(body.conditionType)) {
    return NextResponse.json({ error: "invalid conditionType" }, { status: 400 });
  }

  let params;
  try {
    params = validateRuleParams(body.conditionType, body.params);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid params" },
      { status: 400 },
    );
  }

  const cooldownHours = Number(body.cooldownHours);
  const rule = await prisma.alertRule.create({
    data: {
      name,
      conditionType: body.conditionType,
      params,
      notifyInApp: body.notifyInApp !== false,
      notifyEmail: body.notifyEmail === true,
      cooldownHours:
        Number.isInteger(cooldownHours) && cooldownHours >= 1 && cooldownHours <= 720
          ? cooldownHours
          : 24,
      createdById: auth.user.id,
    },
  });

  await audit(auth.user, "rule.create", { type: "AlertRule", id: rule.id }, {
    name,
    conditionType: rule.conditionType,
  });
  return NextResponse.json(rule, { status: 201 });
}
