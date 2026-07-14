import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Plan } from "@prisma/client";

// GET /api/customers — list all monitored customers with their latest risk score.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      riskScore: true,
      _count: { select: { events: true } },
    },
  });
  return NextResponse.json(customers);
}

// POST /api/customers — add a customer to monitor.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 },
    );
  }

  const plan = Object.values(Plan).includes(body.plan) ? body.plan : Plan.FREE;

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
  return NextResponse.json(customer, { status: 201 });
}
