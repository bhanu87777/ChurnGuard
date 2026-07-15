import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TeamTable } from "@/components/settings/TeamTable";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <TeamTable
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      selfId={session.user.id}
    />
  );
}
