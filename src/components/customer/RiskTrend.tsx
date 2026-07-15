"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  AXIS_STROKE,
  BAND_COLORS,
  BRAND,
  CHART_TOOLTIP_STYLE,
  GRID_STROKE,
} from "@/components/charts/chartTheme";

export interface TrendPoint {
  label: string; // e.g. "Jul 3"
  score: number;
}

export function RiskTrend({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-2 font-medium">Risk trend</h2>
        <p className="text-sm text-muted">
          Not enough history yet. Log activity and re-score to build the trend.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 font-medium">Risk trend (last weeks)</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            {/* Band shading: green / amber / red zones */}
            <ReferenceArea y1={0} y2={33} fill={BAND_COLORS.LOW} fillOpacity={0.06} />
            <ReferenceArea y1={33} y2={66} fill={BAND_COLORS.MEDIUM} fillOpacity={0.06} />
            <ReferenceArea y1={66} y2={100} fill={BAND_COLORS.HIGH} fillOpacity={0.06} />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis domain={[0, 100]} stroke={AXIS_STROKE} fontSize={12} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 3, fill: BRAND }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
