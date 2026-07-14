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
            <ReferenceArea y1={0} y2={33} fill="#22c55e" fillOpacity={0.06} />
            <ReferenceArea y1={33} y2={66} fill="#f59e0b" fillOpacity={0.06} />
            <ReferenceArea y1={66} y2={100} fill="#ef4444" fillOpacity={0.06} />
            <CartesianGrid strokeDasharray="3 3" stroke="#253049" />
            <XAxis dataKey="label" stroke="#93a0b8" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#93a0b8" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "#1a2234",
                border: "1px solid #253049",
                borderRadius: 8,
                color: "#e6eaf2",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: "#6366f1" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
