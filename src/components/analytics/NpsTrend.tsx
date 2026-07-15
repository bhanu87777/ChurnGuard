"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
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

export interface NpsChartPoint {
  month: string;
  avgNps: number | null;
  responses: number;
}

export function NpsTrend({ data }: { data: NpsChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        {/* Detractor / passive / promoter zones, echoing the risk-trend shading */}
        <ReferenceArea y1={0} y2={6} fill={BAND_COLORS.HIGH} fillOpacity={0.06} />
        <ReferenceArea y1={6} y2={8} fill={BAND_COLORS.MEDIUM} fillOpacity={0.06} />
        <ReferenceArea y1={8} y2={10} fill={BAND_COLORS.LOW} fillOpacity={0.06} />
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="month" stroke={AXIS_STROKE} fontSize={12} />
        <YAxis domain={[0, 10]} stroke={AXIS_STROKE} fontSize={12} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Line
          type="monotone"
          dataKey="avgNps"
          name="Avg NPS"
          stroke={BRAND}
          strokeWidth={2}
          connectNulls
          dot={{ r: 3, fill: BRAND }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
