import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

// GET /api/audit — paginated audit trail (admin only).
// ?cursor=<id>&limit=50&action=customer.delete&actorId=...&targetId=...
export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const cursor = url.searchParams.get("cursor");

  const where: Prisma.AuditLogWhereInput = {};
  const action = url.searchParams.get("action");
  const actorId = url.searchParams.get("actorId");
  const targetId = url.searchParams.get("targetId");
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;
  if (targetId) where.targetId = targetId;

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  return NextResponse.json({
    entries: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
