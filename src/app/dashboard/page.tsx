import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { RiskDonut, RevenueAtRiskChart } from "@/components/dashboard/RiskCharts";
import { CustomerTable, type CustomerRow } from "@/components/dashboard/CustomerTable";
import { formatMoney } from "@/lib/utils";
import type { RiskBand } from "@prisma/client";

// Always render per-request so the dashboard reflects the latest scores and
// never gets baked at build time (when the DB may be unreachable).
export const dynamic = "force-dynamic";

// Server component: read straight from the DB, compute the headline metrics,
// and hand plain data to the client components.
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const customers = await prisma.customer.findMany({
    include: { riskScore: true, _count: { select: { events: true } } },
  });

  const rows: CustomerRow[] = customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      plan: c.plan,
      mrr: c.mrr,
      band: c.riskScore?.band ?? null,
      score: c.riskScore?.score ?? null,
      reason: c.riskScore?.reason ?? null,
      eventCount: c._count.events,
    }))
    // Highest risk first so the scary ones sit at the top.
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const bands: RiskBand[] = ["LOW", "MEDIUM", "HIGH"];
  const countByBand = (b: RiskBand) => rows.filter((r) => r.band === b).length;
  const revenueByBand = (b: RiskBand) =>
    rows.filter((r) => r.band === b).reduce((s, r) => s + r.mrr, 0);

  const highCount = countByBand("HIGH");
  const revenueAtRisk = revenueByBand("HIGH") + revenueByBand("MEDIUM");
  const scored = rows.filter((r) => r.score !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
      : 0;

  const donutData = bands
    .map((b) => ({ name: b, value: countByBand(b) }))
    .filter((d) => d.value > 0);
  const revenueData = bands.map((b) => ({ band: b, revenue: revenueByBand(b) }));

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Churn risk overview</h1>
          <p className="text-sm text-muted">
            AI-scored risk for every account, highest risk first.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Customers monitored"
            value={String(rows.length)}
            sub={`${scored.length} scored`}
          />
          <StatCard
            label="High-risk accounts"
            value={String(highCount)}
            accent="high"
            sub="need attention now"
          />
          <StatCard
            label="Revenue at risk"
            value={formatMoney(revenueAtRisk)}
            accent="medium"
            sub="MRR in medium+high bands"
          />
          <StatCard
            label="Avg. risk score"
            value={String(avgScore)}
            accent="brand"
            sub="0 = safe · 100 = leaving"
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <RiskDonut data={donutData} />
          <RevenueAtRiskChart data={revenueData} />
        </div>

        <CustomerTable customers={rows} />
      </main>
    </>
  );
}
