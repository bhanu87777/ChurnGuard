import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AlertRulesPanel } from "@/components/settings/AlertRulesPanel";

export const dynamic = "force-dynamic";

export default async function AlertsSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rules = await prisma.alertRule.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { notifications: true } } },
  });

  return (
    <AlertRulesPanel
      isAdmin={session.user.role === "ADMIN"}
      rules={rules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        conditionType: r.conditionType,
        params: r.params as Record<string, unknown>,
        notifyInApp: r.notifyInApp,
        notifyEmail: r.notifyEmail,
        cooldownHours: r.cooldownHours,
        fired: r._count.notifications,
      }))}
    />
  );
}
