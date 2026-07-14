import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-3xl text-brand-fg">
        ⚡
      </div>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Spot churning customers <span className="text-brand">before</span> they
        cancel.
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        ChurnGuard watches each account&apos;s activity and uses AI to turn raw
        behavior into a churn-risk score — with a plain-English reason and the
        exact save action your team should take next.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-brand px-6 py-3 font-medium text-brand-fg transition hover:opacity-90"
        >
          Open the dashboard →
        </Link>
      </div>
      <div className="mt-16 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
        {[
          {
            t: "Activity → signal",
            d: "Logins, feature use, tickets, and failed payments become churn signals.",
          },
          {
            t: "AI risk score",
            d: "Claude scores each account 0–100 and explains why in plain English.",
          },
          {
            t: "Next best action",
            d: "Every at-risk account comes with a concrete retention play.",
          },
        ].map((f) => (
          <div
            key={f.t}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="font-medium">{f.t}</h3>
            <p className="mt-1 text-sm text-muted">{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
