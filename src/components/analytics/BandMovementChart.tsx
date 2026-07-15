"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export function BandMovementChart({
  improved,
  worsened,
  stable,
}: {
  improved: number;
  worsened: number;
  stable: number;
}) {
  const data = [
    { label: "Improved", value: improved, color: BAND_COLORS.LOW },
    { label: "Stable", value: stable, color: AXIS_STROKE },
    { label: "Worsened", value: worsened, color: BAND_COLORS.HIGH },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke={AXIS_STROKE} fontSize={12} />
        <YAxis type="category" dataKey="label" stroke={AXIS_STROKE} fontSize={12} width={70} />
        <Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={CHART_TOOLTIP_STYLE} />
        <Bar dataKey="value" name="Customers" radius={[0, 6, 6, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
