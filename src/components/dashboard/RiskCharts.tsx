"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  AXIS_STROKE,
  BAND_COLORS,
  BRAND,
  CHART_TOOLTIP_STYLE,
  GRID_STROKE,
} from "@/components/charts/chartTheme";

export function RiskDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-medium text-muted">
        Customers by risk band
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={BAND_COLORS[d.name] ?? BRAND} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-muted">{total} customers monitored</p>
    </div>
  );
}

export function RevenueAtRiskChart({
  data,
}: {
  data: { band: string; revenue: number }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-medium text-muted">
        Monthly revenue by risk band ($)
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="band" stroke={AXIS_STROKE} fontSize={12} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.band} fill={BAND_COLORS[d.band] ?? BRAND} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
