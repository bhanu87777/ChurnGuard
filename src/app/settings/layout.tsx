import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Navbar } from "@/components/Navbar";
import { SettingsNav } from "@/components/settings/SettingsNav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
        <div className="flex flex-col gap-6 md:flex-row">
          <SettingsNav role={session.user.role} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </>
  );
}
