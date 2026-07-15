import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canMutate } from "@/lib/rbac";
import { Navbar } from "@/components/Navbar";
import { ImportWizard } from "@/components/import/ImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canMutate(session.user.role)) redirect("/dashboard");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-semibold">Import customers</h1>
          <p className="text-sm text-muted">
            Upload a CSV with a header row: name, email, company, plan, mrr
            (optionally signupDate, status). Existing customers are matched by
            email and updated.
          </p>
        </div>
        <ImportWizard />
      </main>
    </>
  );
}
