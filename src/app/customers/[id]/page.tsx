import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { RiskBadge } from "@/components/RiskBadge";
import { CustomerActions } from "@/components/customer/CustomerActions";
import { RiskTrend } from "@/components/customer/RiskTrend";
import { LogEventForm } from "@/components/customer/LogEventForm";
import { extractFeatures } from "@/lib/scoring";
import { formatMoney, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const eventLabels: Record<string, string> = {
  LOGIN: "🔓 Logged in",
  FEATURE_USE: "🧩 Used a feature",
  SUPPORT_TICKET: "🎫 Opened a support ticket",
  PAYMENT: "💳 Payment succeeded",
  PAYMENT_FAILED: "⚠️ Payment failed",
  NPS_RESPONSE: "📊 Left an NPS response",
};

export default async function CustomerPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      riskScore: true,
      events: { orderBy: { occurredAt: "desc" } },
      riskHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!customer) notFound();

  const features = extractFeatures(customer);
  const risk = customer.riskScore;

  const trendData = customer.riskHistory.map((h) => ({
    label: new Date(h.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: h.score,
  }));

  const featureRows: { label: string; value: string }[] = [
    { label: "Days since signup", value: String(features.daysSinceSignup) },
    {
      label: "Days since last login",
      value:
        features.daysSinceLastLogin === null
          ? "never"
          : String(features.daysSinceLastLogin),
    },
    { label: "Logins (30d)", value: String(features.logins30d) },
    { label: "Feature uses (30d)", value: String(features.featureUses30d) },
    { label: "Support tickets (30d)", value: String(features.supportTickets30d) },
    { label: "Failed payments (30d)", value: String(features.failedPayments30d) },
    {
      label: "Latest NPS",
      value: features.latestNps === null ? "—" : String(features.latestNps),
    },
  ];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{customer.name}</h1>
            <p className="text-muted">
              {customer.company ?? "—"} · {customer.email}
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted">
              <span>{customer.plan}</span>
              <span>·</span>
              <span>{formatMoney(customer.mrr)}/mo</span>
              <span>·</span>
              <span className={customer.status === "CHURNED" ? "text-high" : "text-low"}>
                {customer.status}
              </span>
            </div>
          </div>
          <CustomerActions customerId={customer.id} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Risk analysis */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">AI risk analysis</h2>
              {risk && <RiskBadge band={risk.band} score={risk.score} />}
            </div>
            {risk ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Risk score</span>
                    <span>{risk.score}/100</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${risk.score}%`,
                        background:
                          risk.band === "HIGH"
                            ? "var(--high)"
                            : risk.band === "MEDIUM"
                              ? "var(--medium)"
                              : "var(--low)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Why</p>
                  <p className="mt-1 text-sm">{risk.reason}</p>
                </div>
                <div className="rounded-lg border border-brand/30 bg-brand/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-brand">
                    Recommended action
                  </p>
                  <p className="mt-1 text-sm">{risk.action}</p>
                </div>
                <p className="text-xs text-muted">Scored by: {risk.model}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Not scored yet. Hit “Re-score” above.
              </p>
            )}
          </div>

          {/* Feature signals */}
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-medium">Engagement signals</h2>
            <dl className="space-y-2">
              {featureRows.map((f) => (
                <div
                  key={f.label}
                  className="flex justify-between border-b border-border/40 pb-2 text-sm last:border-0"
                >
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Trend + live ingestion */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <RiskTrend data={trendData} />
          </div>
          <LogEventForm customerId={customer.id} />
        </div>

        {/* Activity timeline */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-medium">
            Activity timeline{" "}
            <span className="text-muted">({customer.events.length})</span>
          </h2>
          <ol className="space-y-3">
            {customer.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <div className="flex-1">
                  <span>{eventLabels[e.type] ?? e.type}</span>
                  {e.metadata != null && (
                    <span className="ml-2 text-xs text-muted">
                      {JSON.stringify(e.metadata)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">{timeAgo(e.occurredAt)}</span>
              </li>
            ))}
            {customer.events.length === 0 && (
              <li className="text-sm text-muted">No activity recorded.</li>
            )}
          </ol>
        </div>
      </main>
    </>
  );
}
