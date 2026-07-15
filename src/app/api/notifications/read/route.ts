import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

// POST /api/notifications/read — { ids?: string[] }; omit ids to mark all read.
// Always scoped to the caller's own notifications.
export async function POST(req: Request) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === "string")
    : undefined;

  const result = await prisma.notification.updateMany({
    where: {
      userId: auth.user.id,
      readAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ marked: result.count });
}
