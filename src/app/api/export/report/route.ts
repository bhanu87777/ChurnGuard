import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { csvResponse, toCsv } from "@/lib/csv";
import {
  bandMovement,
  churnRateOverTime,
  cohortGrid,
  mrrByBand,
  npsTrend,
} from "@/lib/analytics";

// GET /api/export/report?type=churn|mrr-band|nps|band-movement|cohort
export async function GET(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const type = new URL(req.url).searchParams.get("type");
  const date = new Date().toISOString().slice(0, 10);

  switch (type) {
    case "churn": {
      const data = await churnRateOverTime(12);
      return csvResponse(
        `churnguard-churn-${date}.csv`,
        toCsv(
          ["month", "activeAtStart", "churned", "churnRatePct", "activeMrr"],
          data.map((p) => [
            p.month,
            p.activeAtStart,
            p.churned,
            p.churnRatePct,
            p.activeMrr,
          ]),
        ),
      );
    }
    case "mrr-band": {
      const data = await mrrByBand();
      return csvResponse(
        `churnguard-mrr-band-${date}.csv`,
        toCsv(
          ["band", "mrr", "customers"],
          data.map((b) => [b.band, Math.round(b.mrr), b.customers]),
        ),
      );
    }
    case "nps": {
      const data = await npsTrend(12);
      return csvResponse(
        `churnguard-nps-${date}.csv`,
        toCsv(
          ["month", "avgNps", "responses"],
          data.map((p) => [p.month, p.avgNps, p.responses]),
        ),
      );
    }
    case "band-movement": {
      const data = await bandMovement(30);
      return csvResponse(
        `churnguard-movers-${date}.csv`,
        toCsv(
          ["customer", "from", "to", "scoreDelta"],
          data.movers.map((m) => [m.name, m.from, m.to, m.delta]),
        ),
      );
    }
    case "cohort": {
      const data = await cohortGrid(12);
      const maxCols = Math.max(0, ...data.map((r) => r.retentionPct.length));
      return csvResponse(
        `churnguard-cohorts-${date}.csv`,
        toCsv(
          ["cohort", "size", ...Array.from({ length: maxCols }, (_, i) => `M${i}`)],
          data.map((r) => [r.cohort, r.size, ...r.retentionPct]),
        ),
      );
    }
    default:
      return NextResponse.json(
        { error: "type must be one of: churn, mrr-band, nps, band-movement, cohort" },
        { status: 400 },
      );
  }
}
