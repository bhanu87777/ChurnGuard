import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import {
  segmentToWhere,
  validateSegmentDefinition,
  type SegmentDefinition,
} from "@/lib/segments";

type Params = { params: Promise<{ id: string }> };

// GET /api/segments/:id — the segment plus its matching customers.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const segment = await prisma.segment.findUnique({ where: { id } });
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customers = await prisma.customer.findMany({
    where: segmentToWhere(segment.definition as SegmentDefinition),
    include: { riskScore: true },
    orderBy: { mrr: "desc" },
  });
  return NextResponse.json({ segment, customers });
}

// PATCH /api/segments/:id — rename / redefine.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; definition?: Prisma.InputJsonValue } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 60) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.definition !== undefined) {
    try {
      data.definition = validateSegmentDefinition(
        body.definition,
      ) as Prisma.InputJsonValue;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "invalid definition" },
        { status: 400 },
      );
    }
  }

  const segment = await prisma.segment
    .update({ where: { id }, data })
    .catch(() => null);
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "segment.update", { type: "Segment", id });
  return NextResponse.json(segment);
}

// DELETE /api/segments/:id
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const segment = await prisma.segment
    .delete({ where: { id } })
    .catch(() => null);
  if (!segment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "segment.delete", { type: "Segment", id }, {
    name: segment.name,
  });
  return NextResponse.json({ ok: true });
}
