// Shared card shell for charts, matching the dashboard's chart cards.
export function ChartCard({
  title,
  sub,
  height = "h-56",
  children,
}: {
  title: string;
  sub?: string;
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-medium text-muted">{title}</h3>
      <div className={height}>{children}</div>
      {sub && <p className="mt-2 text-center text-xs text-muted">{sub}</p>}
    </div>
  );
}
