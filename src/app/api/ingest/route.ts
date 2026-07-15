import { NextResponse } from "next/server";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { authenticateApiKey } from "@/lib/api-keys";
import { evaluateRulesOnEvent } from "@/lib/rules";
import { scoreAndSave } from "@/lib/score-service";

interface IngestEvent {
  email: string;
  type: ActivityType;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: string;
}

// POST /api/ingest — public event ingestion for external systems.
//   Header:  X-Api-Key: cg_...
//   Body:    { email, type, metadata?, occurredAt? } or an array of the same.
//            Optional top-level { rescore: true } (or per-request query
//            ?rescore=1) re-scores affected customers after ingest (slower).
// Responds { accepted, rejected: [{ index, email, reason }] }.
export async function POST(req: Request) {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rescore =
    body.rescore === true ||
    new URL(req.url).searchParams.get("rescore") === "1";
  const rawEvents: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(body.events)
      ? body.events
      : [body];

  if (rawEvents.length === 0 || rawEvents.length > 500) {
    return NextResponse.json(
      { error: "provide between 1 and 500 events" },
      { status: 400 },
    );
  }

  // Resolve all referenced customers in one query.
  const emails = [
    ...new Set(
      rawEvents
        .map((e) => String((e as IngestEvent)?.email ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const customers = await prisma.customer.findMany({
    where: { email: { in: emails } },
  });
  const byEmail = new Map(customers.map((c) => [c.email, c]));

  let accepted = 0;
  const rejected: { index: number; email?: string; reason: string }[] = [];
  const touched = new Set<string>();

  for (let i = 0; i < rawEvents.length; i++) {
    const e = rawEvents[i] as IngestEvent;
    const email = String(e?.email ?? "").trim();
    if (!email) {
      rejected.push({ index: i, reason: "email is required" });
      continue;
    }
    const customer = byEmail.get(email);
    if (!customer) {
      rejected.push({ index: i, email, reason: "unknown customer email" });
      continue;
    }
    if (!e.type || !Object.values(ActivityType).includes(e.type)) {
      rejected.push({
        index: i,
        email,
        reason: `type must be one of: ${Object.values(ActivityType).join(", ")}`,
      });
      continue;
    }
    const occurredAt = e.occurredAt ? new Date(e.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      rejected.push({ index: i, email, reason: "invalid occurredAt" });
      continue;
    }

    const event = await prisma.activityEvent.create({
      data: {
        customerId: customer.id,
        type: e.type,
        metadata: e.metadata ?? undefined,
        occurredAt,
      },
    });
    accepted++;
    touched.add(customer.id);

    await evaluateRulesOnEvent(customer, event).catch((err) =>
      console.error("rule evaluation failed:", err),
    );
  }

  if (rescore) {
    for (const customerId of touched) {
      await scoreAndSave(customerId).catch((err) =>
        console.error("post-ingest rescore failed:", err),
      );
    }
  }

  await audit(null, "event.ingest", undefined, {
    apiKeyId: apiKey.id,
    apiKeyLabel: apiKey.label,
    accepted,
    rejected: rejected.length,
    rescored: rescore ? touched.size : 0,
  });
  return NextResponse.json({ accepted, rejected });
}
