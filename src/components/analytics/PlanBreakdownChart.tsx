"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_STROKE,
  BAND_COLORS,
  CHART_TOOLTIP_STYLE,
  GRID_STROKE,
} from "@/components/charts/chartTheme";

export interface PlanBreakdownRow {
  plan: string;
  counts: Record<string, number>;
  mrr: Record<string, number>;
}

const BANDS = ["LOW", "MEDIUM", "HIGH"] as const;

export function PlanBreakdownChart({ data }: { data: PlanBreakdownRow[] }) {
  const [mode, setMode] = useState<"customers" | "mrr">("customers");

  const chartData = data.map((row) => ({
    plan: row.plan,
    LOW: mode === "customers" ? row.counts.LOW : Math.round(row.mrr.LOW),
    MEDIUM: mode === "customers" ? row.counts.MEDIUM : Math.round(row.mrr.MEDIUM),
    HIGH: mode === "customers" ? row.counts.HIGH : Math.round(row.mrr.HIGH),
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex justify-end gap-1">
        {(["customers", "mrr"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              mode === m
                ? "bg-brand text-brand-fg"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {m === "customers" ? "Customers" : "MRR ($)"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="plan" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis allowDecimals={false} stroke={AXIS_STROKE} fontSize={12} />
            <Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
            {BANDS.map((b, i) => (
              <Bar
                key={b}
                dataKey={b}
                stackId="bands"
                fill={BAND_COLORS[b]}
                radius={i === BANDS.length - 1 ? [6, 6, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
