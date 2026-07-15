import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Plan } from "@prisma/client";

// GET /api/customers — list all monitored customers with their latest risk score.
export async function GET() {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      riskScore: true,
      tags: { include: { tag: true } },
      _count: { select: { events: true } },
    },
  });
  return NextResponse.json(customers);
}

// POST /api/customers — add a customer to monitor.
export async function POST(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 },
    );
  }

  const plan = Object.values(Plan).includes(body.plan) ? body.plan : Plan.FREE;

  const existing = await prisma.customer.findUnique({
    where: { email: String(body.email) },
  });
  if (existing) {
    return NextResponse.json(
      { error: "a customer with that email already exists" },
      { status: 409 },
    );
  }

  const customer = await prisma.customer.create({
    data: {
      name: String(body.name),
      email: String(body.email),
      company: body.company ? String(body.company) : null,
      plan,
      mrr: Number(body.mrr) || 0,
      signupDate: body.signupDate ? new Date(body.signupDate) : new Date(),
    },
  });

  await audit(auth.user, "customer.create", {
    type: "Customer",
    id: customer.id,
  });
  return NextResponse.json(customer, { status: 201 });
}
