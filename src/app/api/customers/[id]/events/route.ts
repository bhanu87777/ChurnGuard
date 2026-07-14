import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ActivityType, Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// POST /api/customers/:id/events — ingest a new activity event for a customer.
// This is the real-world ingestion path (a webhook/SDK would hit this); in the
// demo the UI uses it to log an event and immediately see risk change.
export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  return NextResponse.json(event, { status: 201 });
}
