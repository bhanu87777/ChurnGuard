import type { RiskBand } from "@prisma/client";
import { bandClasses } from "@/lib/utils";

export function RiskBadge({
  band,
  score,
}: {
  band: RiskBand;
  score?: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${bandClasses[band]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {band}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
