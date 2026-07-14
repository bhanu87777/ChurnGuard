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

const COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};

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
                <Cell key={d.name} fill={COLORS[d.name] ?? "#6366f1"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#1a2234",
                border: "1px solid #253049",
                borderRadius: 8,
                color: "#e6eaf2",
              }}
            />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#253049" />
            <XAxis dataKey="band" stroke="#93a0b8" fontSize={12} />
            <YAxis stroke="#93a0b8" fontSize={12} />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              contentStyle={{
                background: "#1a2234",
                border: "1px solid #253049",
                borderRadius: 8,
                color: "#e6eaf2",
              }}
            />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.band} fill={COLORS[d.band] ?? "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
