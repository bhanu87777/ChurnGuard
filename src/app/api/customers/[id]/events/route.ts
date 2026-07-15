import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { evaluateRulesOnEvent } from "@/lib/rules";
import { ActivityType, Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// POST /api/customers/:id/events — ingest a new activity event for a customer.
// This is the in-app ingestion path; external systems use /api/ingest with an
// API key instead.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.type || !Object.values(ActivityType).includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${Object.values(ActivityType).join(", ")}` },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = await prisma.activityEvent.create({
    data: {
      customerId: id,
      type: body.type as ActivityType,
      metadata: (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
  });

  await evaluateRulesOnEvent(customer, event).catch((err) =>
    console.error("rule evaluation failed:", err),
  );

  await audit(auth.user, "event.create", { type: "Customer", id }, {
    eventType: event.type,
  });
  return NextResponse.json(event, { status: 201 });
}
