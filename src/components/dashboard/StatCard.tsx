// Explicit class map so Tailwind's compile-time scanner sees every class.
const accentClass = {
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
  brand: "text-brand",
  none: "text-foreground",
} as const;

export function StatCard({
  label,
  value,
  sub,
  accent = "none",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: keyof typeof accentClass;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClass[accent]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
