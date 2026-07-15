"use client";

import { useToast } from "@/components/ui/Toast";

const REPORTS = [
  { type: "churn", label: "Churn rate" },
  { type: "mrr-band", label: "MRR by band" },
  { type: "nps", label: "NPS" },
  { type: "band-movement", label: "Movers" },
  { type: "cohort", label: "Cohorts" },
];

export function ExportMenu({ canExport }: { canExport: boolean }) {
  const { toast } = useToast();
  if (!canExport) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Export CSV:</span>
      {REPORTS.map((r) => (
        <a
          key={r.type}
          href={`/api/export/report?type=${r.type}`}
          onClick={() => toast(`${r.label} export started.`)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground"
        >
          {r.label}
        </a>
      ))}
    </div>
  );
}
