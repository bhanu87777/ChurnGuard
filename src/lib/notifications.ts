import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

// Fan a notification out to every active operator (one row per user so each
// person has their own read/unread state). Returns how many were created.
export async function notifyAllUsers(n: {
  title: string;
  body: string;
  type: NotificationType;
  ruleId?: string;
  customerId?: string;
}): Promise<number> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      title: n.title,
      body: n.body,
      type: n.type,
      ruleId: n.ruleId ?? null,
      customerId: n.customerId ?? null,
    })),
  });
  return users.length;
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
