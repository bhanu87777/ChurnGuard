import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Profile</h2>
        <p className="mt-1 text-sm text-muted">
          {user.email} · {user.role.toLowerCase()} access
        </p>
      </div>
      <ProfileForm initialName={user.name ?? ""} />
    </div>
  );
}
