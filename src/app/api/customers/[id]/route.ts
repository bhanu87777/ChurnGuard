import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { CustomerStatus, Plan } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/:id — full detail including events and risk score.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      riskScore: true,
      tags: { include: { tag: true } },
      events: { orderBy: { occurredAt: "desc" } },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

// PATCH /api/customers/:id — update editable fields.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const field of ["name", "email", "company"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.plan !== undefined) {
    if (!Object.values(Plan).includes(body.plan)) {
      return NextResponse.json({ error: "invalid plan" }, { status: 400 });
    }
    data.plan = body.plan;
  }
  if (body.status !== undefined) {
    if (!Object.values(CustomerStatus).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
    // churnedAt tracks the ACTIVE -> CHURNED transition for churn analytics.
    if (body.status === "CHURNED" && existing.status === "ACTIVE") {
      data.churnedAt = new Date();
    } else if (body.status === "ACTIVE" && existing.status === "CHURNED") {
      data.churnedAt = null;
    }
  }
  if (body.mrr !== undefined) data.mrr = Number(body.mrr) || 0;

  const customer = await prisma.customer.update({ where: { id }, data });

  await audit(auth.user, "customer.update", { type: "Customer", id }, {
    changed: Object.keys(data),
  });
  return NextResponse.json(customer);
}

// DELETE /api/customers/:id — stop monitoring (cascades events, score, notes, tasks).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const customer = await prisma.customer
    .delete({ where: { id } })
    .catch(() => null);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "customer.delete", { type: "Customer", id }, {
    name: customer.name,
    email: customer.email,
  });
  return NextResponse.json({ ok: true });
}
