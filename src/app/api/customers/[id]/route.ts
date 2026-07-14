import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/:id — full detail including events and risk score.
export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      riskScore: true,
      events: { orderBy: { occurredAt: "desc" } },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

// PATCH /api/customers/:id — update editable fields.
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const field of ["name", "email", "company", "plan", "status"]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.mrr !== undefined) data.mrr = Number(body.mrr) || 0;

  const customer = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(customer);
}

// DELETE /api/customers/:id — stop monitoring (cascades events + score).
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
