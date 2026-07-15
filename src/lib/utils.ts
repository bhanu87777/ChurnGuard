import type { RiskBand } from "@prisma/client";

export const bandColor: Record<RiskBand, string> = {
  LOW: "var(--low)",
  MEDIUM: "var(--medium)",
  HIGH: "var(--high)",
};

export const bandClasses: Record<RiskBand, string> = {
  LOW: "bg-low/15 text-low border-low/30",
  MEDIUM: "bg-medium/15 text-medium border-medium/30",
  HIGH: "bg-high/15 text-high border-high/30",
};

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

// "2026-07" / Date -> "Jul 2026" for cohort & trend labels.
export function formatMonth(month: Date | string): string {
  const d =
    typeof month === "string" && /^\d{4}-\d{2}$/.test(month)
      ? new Date(`${month}-01T00:00:00Z`)
      : new Date(month);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function timeAgo(date: Date | string): string {
  const d = new Date(date).getTime();
  const days = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
