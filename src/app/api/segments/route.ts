import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateSegmentDefinition } from "@/lib/segments";

// GET /api/segments — all saved segments.
export async function GET() {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const segments = await prisma.segment.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(segments);
}

// POST /api/segments — save the current filters as a segment.
export async function POST(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "name is required (max 60 chars)" }, { status: 400 });
  }

  let definition;
  try {
    definition = validateSegmentDefinition(body.definition);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid definition" },
      { status: 400 },
    );
  }

  const segment = await prisma.segment.upsert({
    where: { name },
    update: { definition: definition as Prisma.InputJsonValue },
    create: {
      name,
      definition: definition as Prisma.InputJsonValue,
      createdById: auth.user.id,
    },
  });

  await audit(auth.user, "segment.create", { type: "Segment", id: segment.id }, {
    name,
  });
  return NextResponse.json(segment, { status: 201 });
}
