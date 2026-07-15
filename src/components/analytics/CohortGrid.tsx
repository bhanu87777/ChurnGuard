import type { CohortRow } from "@/lib/analytics";
import { formatMonth } from "@/lib/utils";

// Plain HTML heatmap (server component, no Recharts needed): rows are signup
// cohorts, columns are months-since-signup, cells shade by retention.
export function CohortGrid({ rows }: { rows: CohortRow[] }) {
  const maxCols = Math.max(0, ...rows.map((r) => r.retentionPct.filter((v) => v !== null).length));

  if (rows.length === 0 || maxCols === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Not enough signup history for cohorts yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-2 py-1.5 font-medium">Cohort</th>
            <th className="px-2 py-1.5 font-medium">Size</th>
            {Array.from({ length: maxCols }, (_, i) => (
              <th key={i} className="px-2 py-1.5 text-center font-medium">
                M{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohort}>
              <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                {formatMonth(row.cohort)}
              </td>
              <td className="px-2 py-1.5 text-muted">{row.size}</td>
              {Array.from({ length: maxCols }, (_, i) => {
                const v = row.retentionPct[i] ?? null;
                return (
                  <td
                    key={i}
                    title={v === null ? "" : `${v}% retained after ${i + 1} month(s)`}
                    className="rounded-md px-2 py-1.5 text-center"
                    style={
                      v === null
                        ? undefined
                        : {
                            background: `color-mix(in srgb, var(--brand) ${Math.round(v * 0.75)}%, transparent)`,
                          }
                    }
                  >
                    {v === null ? "" : `${v}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
