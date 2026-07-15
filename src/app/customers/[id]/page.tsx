import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canMutate, isAdmin } from "@/lib/rbac";
import { Navbar } from "@/components/Navbar";
import { RiskBadge } from "@/components/RiskBadge";
import { CustomerActions } from "@/components/customer/CustomerActions";
import { RiskTrend } from "@/components/customer/RiskTrend";
import { LogEventForm } from "@/components/customer/LogEventForm";
import { TagEditor } from "@/components/customer/TagEditor";
import { CustomerTabs } from "@/components/customer/CustomerTabs";
import { extractFeatures } from "@/lib/scoring";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function CustomerPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = session.user.role;
  const editable = canMutate(role);

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      riskScore: true,
      events: { orderBy: { occurredAt: "desc" } },
      riskHistory: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { assignee: { select: { id: true, name: true, email: true } } },
      },
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
            <TagEditor
              customerId={customer.id}
              tags={customer.tags.map((t) => t.tag)}
              canEdit={editable}
            />
          </div>
          <CustomerActions
            customerId={customer.id}
            canRescore={editable}
            canDelete={isAdmin(role)}
          />
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
          <div className={editable ? "md:col-span-2" : "md:col-span-3"}>
            <RiskTrend data={trendData} />
          </div>
          {editable && <LogEventForm customerId={customer.id} />}
        </div>

        {/* Activity / notes / interventions */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <CustomerTabs
            customerId={customer.id}
            events={customer.events.map((e) => ({
              id: e.id,
              type: e.type,
              metadata: e.metadata,
              occurredAt: e.occurredAt.toISOString(),
            }))}
            notes={customer.notes.map((n) => ({
              id: n.id,
              body: n.body,
              createdAt: n.createdAt.toISOString(),
              author: n.author,
            }))}
            tasks={customer.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              outcome: t.outcome,
              dueDate: t.dueDate?.toISOString() ?? null,
              completedAt: t.completedAt?.toISOString() ?? null,
              assignee: t.assignee,
            }))}
            selfId={session.user.id}
            canEdit={editable}
            isAdmin={isAdmin(role)}
          />
        </div>
      </main>
    </>
  );
}
