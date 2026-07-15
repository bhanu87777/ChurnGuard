export function TagChip({
  name,
  color,
  onRemove,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {name}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove tag ${name}`}
          className="text-muted transition hover:text-high"
        >
          ×
        </button>
      )}
    </span>
  );
}
