"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_STROKE,
  BAND_COLORS,
  BRAND,
  CHART_TOOLTIP_STYLE,
  GRID_STROKE,
} from "@/components/charts/chartTheme";

export interface ChurnMrrPoint {
  month: string; // "Jul 2026"
  mrr: number;
  churnRatePct: number;
}

export function ChurnMrrTrend({ data }: { data: ChurnMrrPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.3} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="month" stroke={AXIS_STROKE} fontSize={12} />
        <YAxis
          yAxisId="mrr"
          stroke={AXIS_STROKE}
          fontSize={12}
          tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}`}
        />
        <YAxis
          yAxisId="churn"
          orientation="right"
          stroke={BAND_COLORS.HIGH}
          fontSize={12}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Area
          yAxisId="mrr"
          type="monotone"
          dataKey="mrr"
          name="Active MRR ($)"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#mrrFill)"
        />
        <Line
          yAxisId="churn"
          type="monotone"
          dataKey="churnRatePct"
          name="Churn rate (%)"
          stroke={BAND_COLORS.HIGH}
          strokeWidth={2}
          dot={{ r: 3, fill: BAND_COLORS.HIGH }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
