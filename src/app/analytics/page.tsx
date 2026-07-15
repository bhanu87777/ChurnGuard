import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canMutate } from "@/lib/rbac";
import {
  bandMovement,
  churnRateOverTime,
  cohortGrid,
  mrrByBand,
  mrrByPlan,
  npsTrend,
} from "@/lib/analytics";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChurnMrrTrend } from "@/components/analytics/ChurnMrrTrend";
import { NpsTrend } from "@/components/analytics/NpsTrend";
import { BandMovementChart } from "@/components/analytics/BandMovementChart";
import { PlanBreakdownChart } from "@/components/analytics/PlanBreakdownChart";
import { CohortGrid } from "@/components/analytics/CohortGrid";
import { ExportMenu } from "@/components/analytics/ExportMenu";
import { formatMoney, formatMonth, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [churn, bands, plans, nps, movement, cohorts] = await Promise.all([
    churnRateOverTime(12),
    mrrByBand(),
    mrrByPlan(),
    npsTrend(12),
    bandMovement(30),
    cohortGrid(12),
  ]);

  const thisMonth = churn[churn.length - 1];
  const lastMonth = churn[churn.length - 2];
  const totalMrr = bands.reduce((s, b) => s + b.mrr, 0);
  const mrrDelta = lastMonth ? thisMonth.activeMrr - lastMonth.activeMrr : 0;
  const latestNps = [...nps].reverse().find((p) => p.avgNps !== null);

  const trendData = churn.map((p) => ({
    month: formatMonth(p.month),
    mrr: p.activeMrr,
    churnRatePct: p.churnRatePct,
  }));
  const npsData = nps.map((p) => ({ ...p, month: formatMonth(p.month) }));

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted">
              Churn, revenue, and sentiment trends across the whole book of
              business.
            </p>
          </div>
          <ExportMenu canExport={canMutate(session.user.role)} />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Churn rate (this month)"
            value={formatPercent(thisMonth.churnRatePct)}
            accent={thisMonth.churnRatePct > 0 ? "high" : "low"}
            sub={`${thisMonth.churned} of ${thisMonth.activeAtStart} accounts`}
          />
          <StatCard
            label="Active MRR"
            value={formatMoney(totalMrr)}
            accent="brand"
            sub="across active customers"
          />
          <StatCard
            label="MRR change (MoM)"
            value={`${mrrDelta >= 0 ? "+" : ""}${formatMoney(mrrDelta)}`}
            accent={mrrDelta >= 0 ? "low" : "high"}
            sub="vs. last month (approx.)"
          />
          <StatCard
            label="Avg NPS (latest)"
            value={latestNps?.avgNps !== undefined && latestNps?.avgNps !== null ? String(latestNps.avgNps) : "—"}
            accent={
              latestNps?.avgNps == null
                ? "none"
                : latestNps.avgNps >= 8
                  ? "low"
                  : latestNps.avgNps >= 6
                    ? "medium"
                    : "high"
            }
            sub={latestNps ? `${latestNps.responses} responses` : "no responses yet"}
          />
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Active MRR vs. churn rate (12 months)"
            sub="MRR uses each account's current value — historical MRR isn't tracked."
            height="h-64"
          >
            <ChurnMrrTrend data={trendData} />
          </ChartCard>
          <ChartCard title="Average NPS by month" height="h-64">
            <NpsTrend data={npsData} />
          </ChartCard>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Risk movement (last 30 days)"
            sub={`${movement.improved} improved · ${movement.stable} stable · ${movement.worsened} worsened`}
          >
            <BandMovementChart
              improved={movement.improved}
              worsened={movement.worsened}
              stable={movement.stable}
            />
          </ChartCard>
          <ChartCard title="Plan mix by risk band" height="h-56">
            <PlanBreakdownChart
              data={plans.map((p) => ({
                plan: p.plan,
                counts: p.counts,
                mrr: p.mrr,
              }))}
            />
          </ChartCard>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-1 text-sm font-medium text-muted">
            Retention by signup cohort
          </h3>
          <p className="mb-3 text-xs text-muted">
            Each cell: % of the cohort still active after N months.
          </p>
          <CohortGrid rows={cohorts} />
        </div>
      </main>
    </>
  );
}
