import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { unreadCount } from "@/lib/notifications";

// GET /api/notifications — own notifications, newest first.
//   ?countOnly=1  → { unread } only (cheap poll for the bell badge)
//   ?cursor=<id>  → next page
export async function GET(req: Request) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  if (url.searchParams.get("countOnly")) {
    return NextResponse.json({ unread: await unreadCount(auth.user.id) });
  }

  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      customerId: true,
      readAt: true,
      createdAt: true,
    },
  });

  const hasMore = notifications.length > limit;
  const page = hasMore ? notifications.slice(0, limit) : notifications;
  return NextResponse.json({
    notifications: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unread: await unreadCount(auth.user.id),
  });
}
