export function EmptyState({
  glyph,
  title,
  hint,
  action,
}: {
  glyph: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span className="text-3xl">{glyph}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
