// Single source of truth for Recharts styling so every chart in the app
// (dashboard, customer trend, analytics) reads as one system.

export const CHART_TOOLTIP_STYLE = {
  background: "#1a2234",
  border: "1px solid #253049",
  borderRadius: 8,
  color: "#e6eaf2",
} as const;

export const AXIS_STROKE = "#93a0b8";
export const GRID_STROKE = "#253049";
export const BRAND = "#6366f1";

export const BAND_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};
