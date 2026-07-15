import type { Plan, RiskBand } from "@prisma/client";
import { prisma } from "./prisma";

// Server-only aggregation helpers behind the /analytics page and report
// exports. Everything is computed from Customer (signupDate/status/churnedAt),
// RiskScoreHistory, and ActivityEvent — no new state.

const BAND_RANK: Record<RiskBand, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

// --- Churn rate over time ----------------------------------------------------
export interface ChurnPoint {
  month: string; // "2026-07"
  activeAtStart: number;
  churned: number;
  churnRatePct: number;
  // Sum of *current* MRR across customers active at month start — an
  // approximation, since MRR history isn't stored.
  activeMrr: number;
}

export async function churnRateOverTime(months = 12): Promise<ChurnPoint[]> {
  const customers = await prisma.customer.findMany({
    select: { signupDate: true, status: true, churnedAt: true, mrr: true },
  });

  const now = new Date();
  const points: ChurnPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(monthStart(now), -i);
    const end = addMonths(start, 1);

    // Active at month start = signed up before it and not yet churned by it.
    // Legacy CHURNED rows without churnedAt are treated as churned "now".
    const activeCustomers = customers.filter((c) => {
      const churnedAt =
        c.status === "CHURNED" ? (c.churnedAt ?? now) : c.churnedAt;
      return (
        c.signupDate < start && (churnedAt === null || churnedAt >= start)
      );
    });
    const activeAtStart = activeCustomers.length;

    const churned = customers.filter((c) => {
      const churnedAt =
        c.status === "CHURNED" ? (c.churnedAt ?? now) : null;
      return churnedAt !== null && churnedAt >= start && churnedAt < end;
    }).length;

    points.push({
      month: monthKey(start),
      activeAtStart,
      churned,
      churnRatePct:
        activeAtStart > 0
          ? Math.round((churned / activeAtStart) * 1000) / 10
          : 0,
      activeMrr: Math.round(
        activeCustomers.reduce((s, c) => s + c.mrr, 0),
      ),
    });
  }
  return points;
}

// --- MRR breakdowns ----------------------------------------------------------
export interface BandBreakdown {
  band: RiskBand | "UNSCORED";
  mrr: number;
  customers: number;
}

export async function mrrByBand(): Promise<BandBreakdown[]> {
  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { mrr: true, riskScore: { select: { band: true } } },
  });
  const groups = new Map<BandBreakdown["band"], BandBreakdown>();
  for (const c of customers) {
    const band = c.riskScore?.band ?? "UNSCORED";
    const g = groups.get(band) ?? { band, mrr: 0, customers: 0 };
    g.mrr += c.mrr;
    g.customers++;
    groups.set(band, g);
  }
  return [...groups.values()];
}

export interface PlanBreakdown {
  plan: Plan;
  counts: Record<RiskBand | "UNSCORED", number>;
  mrr: Record<RiskBand | "UNSCORED", number>;
}

export async function mrrByPlan(): Promise<PlanBreakdown[]> {
  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { plan: true, mrr: true, riskScore: { select: { band: true } } },
  });
  const groups = new Map<Plan, PlanBreakdown>();
  for (const c of customers) {
    const band = c.riskScore?.band ?? "UNSCORED";
    const g =
      groups.get(c.plan) ??
      ({
        plan: c.plan,
        counts: { LOW: 0, MEDIUM: 0, HIGH: 0, UNSCORED: 0 },
        mrr: { LOW: 0, MEDIUM: 0, HIGH: 0, UNSCORED: 0 },
      } satisfies PlanBreakdown);
    g.counts[band]++;
    g.mrr[band] += c.mrr;
    groups.set(c.plan, g);
  }
  const order: Plan[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
  return order.filter((p) => groups.has(p)).map((p) => groups.get(p)!);
}

// --- MRR by band over time (approximation: current MRR × historical band) ----
export interface MrrBandWeekPoint {
  week: string; // "Jul 3"
  LOW: number;
  MEDIUM: number;
  HIGH: number;
}

export async function mrrByBandOverTime(weeks = 12): Promise<MrrBandWeekPoint[]> {
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const history = await prisma.riskScoreHistory.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      customerId: true,
      band: true,
      createdAt: true,
      customer: { select: { mrr: true } },
    },
  });

  const points: MrrBandWeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    // Latest snapshot per customer at or before this week's end.
    const latest = new Map<string, (typeof history)[number]>();
    for (const h of history) {
      if (h.createdAt <= end) latest.set(h.customerId, h);
    }
    const point: MrrBandWeekPoint = {
      week: end.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };
    for (const h of latest.values()) point[h.band] += h.customer.mrr;
    points.push(point);
  }
  return points;
}

// --- NPS trend ---------------------------------------------------------------
export interface NpsPoint {
  month: string;
  avgNps: number | null;
  responses: number;
}

export async function npsTrend(months = 12): Promise<NpsPoint[]> {
  const since = addMonths(monthStart(new Date()), -(months - 1));
  const events = await prisma.activityEvent.findMany({
    where: { type: "NPS_RESPONSE", occurredAt: { gte: since } },
    select: { occurredAt: true, metadata: true },
  });

  const byMonth = new Map<string, { sum: number; n: number }>();
  for (const e of events) {
    const score = Number((e.metadata as { score?: number } | null)?.score);
    if (!Number.isFinite(score)) continue;
    const key = monthKey(monthStart(e.occurredAt));
    const g = byMonth.get(key) ?? { sum: 0, n: 0 };
    g.sum += score;
    g.n++;
    byMonth.set(key, g);
  }

  const points: NpsPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = monthKey(addMonths(monthStart(new Date()), -i));
    const g = byMonth.get(key);
    points.push({
      month: key,
      avgNps: g ? Math.round((g.sum / g.n) * 10) / 10 : null,
      responses: g?.n ?? 0,
    });
  }
  return points;
}

// --- Band movement (who improved / worsened in a window) ---------------------
export interface BandMovement {
  improved: number;
  worsened: number;
  stable: number;
  movers: Array<{
    customerId: string;
    name: string;
    from: RiskBand;
    to: RiskBand;
    delta: number;
  }>;
}

export async function bandMovement(days = 30): Promise<BandMovement> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const history = await prisma.riskScoreHistory.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const perCustomer = new Map<
    string,
    { first: (typeof history)[number]; last: (typeof history)[number] }
  >();
  for (const h of history) {
    const entry = perCustomer.get(h.customerId);
    if (!entry) perCustomer.set(h.customerId, { first: h, last: h });
    else entry.last = h;
  }

  const result: BandMovement = { improved: 0, worsened: 0, stable: 0, movers: [] };
  for (const [customerId, { first, last }] of perCustomer) {
    if (first.id === last.id) {
      result.stable++;
      continue;
    }
    const rankDelta = BAND_RANK[last.band] - BAND_RANK[first.band];
    if (rankDelta < 0) result.improved++;
    else if (rankDelta > 0) result.worsened++;
    else result.stable++;
    if (rankDelta !== 0) {
      result.movers.push({
        customerId,
        name: last.customer.name,
        from: first.band,
        to: last.band,
        delta: last.score - first.score,
      });
    }
  }
  result.movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return result;
}

// --- Cohort retention grid ---------------------------------------------------
export interface CohortRow {
  cohort: string; // "2026-01"
  size: number;
  retentionPct: (number | null)[]; // index = months since signup; null = future
}

export async function cohortGrid(months = 12): Promise<CohortRow[]> {
  const oldest = addMonths(monthStart(new Date()), -(months - 1));
  const customers = await prisma.customer.findMany({
    where: { signupDate: { gte: oldest } },
    select: { signupDate: true, status: true, churnedAt: true },
  });

  const now = new Date();
  const cohorts = new Map<string, typeof customers>();
  for (const c of customers) {
    const key = monthKey(monthStart(c.signupDate));
    const list = cohorts.get(key) ?? [];
    list.push(c);
    cohorts.set(key, list);
  }

  const rows: CohortRow[] = [];
  const sortedKeys = [...cohorts.keys()].sort();
  for (const key of sortedKeys) {
    const members = cohorts.get(key)!;
    const cohortStart = new Date(`${key}-01T00:00:00Z`);
    const maxAge = Math.floor(
      (now.getTime() - cohortStart.getTime()) / MONTH_MS,
    );
    const retentionPct: (number | null)[] = [];
    for (let m = 0; m < months; m++) {
      if (m > maxAge) {
        retentionPct.push(null);
        continue;
      }
      const checkpoint = addMonths(cohortStart, m + 1);
      const retained = members.filter((c) => {
        const churnedAt =
          c.status === "CHURNED" ? (c.churnedAt ?? now) : c.churnedAt;
        return churnedAt === null || churnedAt >= checkpoint;
      }).length;
      retentionPct.push(Math.round((retained / members.length) * 100));
    }
    rows.push({ cohort: key, size: members.length, retentionPct });
  }
  return rows;
}
