import { NextResponse } from "next/server";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 2000;

// POST /api/import/events — raw CSV with header:
//   customerEmail,type[,occurredAt][,metadata]
// metadata (when present) must be a JSON object string.
export async function POST(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const text = await req.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSV must have a header row and at least one data row" },
      { status: 400 },
    );
  }
  if (rows.length - 1 > MAX_ROWS) {
    return NextResponse.json(
      { error: `too many rows — max ${MAX_ROWS} per import` },
      { status: 400 },
    );
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("customeremail") === -1 || col("type") === -1) {
    return NextResponse.json(
      { error: "header must include at least: customerEmail,type" },
      { status: 400 },
    );
  }

  // Resolve emails once up front.
  const emails = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const idx = col("customeremail");
    const email = (rows[i][idx] ?? "").trim();
    if (email) emails.add(email);
  }
  const customers = await prisma.customer.findMany({
    where: { email: { in: [...emails] } },
    select: { id: true, email: true },
  });
  const idByEmail = new Map(customers.map((c) => [c.email, c.id]));

  let imported = 0;
  const errors: { line: number; message: string }[] = [];
  const toCreate: Prisma.ActivityEventCreateManyInput[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const get = (name: string) => {
      const idx = col(name);
      return idx === -1 ? "" : (row[idx] ?? "").trim();
    };

    const email = get("customeremail");
    const customerId = idByEmail.get(email);
    if (!customerId) {
      errors.push({ line, message: `unknown customer email "${email}"` });
      continue;
    }

    const typeRaw = get("type").toUpperCase();
    if (!Object.values(ActivityType).includes(typeRaw as ActivityType)) {
      errors.push({ line, message: `invalid type "${typeRaw}"` });
      continue;
    }

    const occurredRaw = get("occurredat");
    const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      errors.push({ line, message: `invalid occurredAt "${occurredRaw}"` });
      continue;
    }

    let metadata: Prisma.InputJsonValue | undefined;
    const metaRaw = get("metadata");
    if (metaRaw) {
      try {
        metadata = JSON.parse(metaRaw);
      } catch {
        errors.push({ line, message: "metadata is not valid JSON" });
        continue;
      }
    }

    toCreate.push({
      customerId,
      type: typeRaw as ActivityType,
      occurredAt,
      metadata,
    });
    imported++;
  }

  if (toCreate.length > 0) {
    await prisma.activityEvent.createMany({ data: toCreate });
  }

  await audit(auth.user, "import.events", undefined, {
    imported,
    errors: errors.length,
  });
  return NextResponse.json({ imported, errors });
}
