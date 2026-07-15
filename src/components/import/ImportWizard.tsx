"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { parseCsv } from "@/lib/csv";

type Step = 1 | 2 | 3;

interface PreviewRow {
  line: number;
  values: string[];
  error: string | null;
}

const PLANS = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
const STATUSES = ["ACTIVE", "CHURNED"];
const PREVIEW_LIMIT = 20;

export function ImportWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [csvText, setCsvText] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    errors: { line: number; message: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function validateRow(head: string[], values: string[]): string | null {
    const col = (name: string) => {
      const idx = head.indexOf(name);
      return idx === -1 ? "" : (values[idx] ?? "").trim();
    };
    if (!col("name")) return "name is required";
    const email = col("email");
    if (!email) return "email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "invalid email";
    const plan = col("plan").toUpperCase();
    if (plan && !PLANS.includes(plan)) return `unknown plan "${plan}"`;
    const mrr = col("mrr");
    if (mrr && (!Number.isFinite(Number(mrr)) || Number(mrr) < 0))
      return `invalid mrr "${mrr}"`;
    const status = col("status").toUpperCase();
    if (status && !STATUSES.includes(status)) return `invalid status "${status}"`;
    return null;
  }

  function loadFile(file: File) {
    file.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        toast("CSV needs a header row and at least one data row.", "error");
        return;
      }
      const head = parsed[0].map((h) => h.trim().toLowerCase());
      if (!head.includes("name") || !head.includes("email")) {
        toast("Header must include name and email columns.", "error");
        return;
      }
      setCsvText(text);
      setHeader(head);
      setRows(
        parsed.slice(1).map((values, i) => ({
          line: i + 2,
          values,
          error: validateRow(head, values),
        })),
      );
      setStep(2);
    });
  }

  async function confirm() {
    setUploading(true);
    try {
      const res = await fetch("/api/import/customers", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvText,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setResult(data);
        setStep(3);
      } else {
        toast(data?.error ?? "Import failed.", "error");
      }
    } finally {
      setUploading(false);
    }
  }

  const valid = rows.filter((r) => !r.error).length;
  const invalid = rows.length - valid;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <ol className="flex items-center gap-3 text-xs">
        {(["Upload", "Preview", "Confirm"] as const).map((label, i) => {
          const n = (i + 1) as Step;
          const state = step === n ? "active" : step > n ? "done" : "pending";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-medium ${
                  state === "pending"
                    ? "border border-border text-muted"
                    : "bg-brand text-brand-fg"
                }`}
              >
                {state === "done" ? "✓" : n}
              </span>
              <span className={state === "pending" ? "text-muted" : ""}>
                {label}
              </span>
              {i < 2 && <span className="w-8 border-t border-border" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) loadFile(file);
          }}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-brand bg-brand/5" : "border-border"
          }`}
        >
          <p className="text-3xl">📄</p>
          <p className="mt-3 text-sm font-medium">
            Drag a CSV here, or{" "}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-brand hover:underline"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-muted">
            Up to 2,000 rows per import. Matched by email — safe to re-run.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm">
            <span>
              <span className="text-low">{valid} valid</span>
              {invalid > 0 && (
                <>
                  {" · "}
                  <span className="text-high">{invalid} will be skipped</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted">
              showing first {Math.min(rows.length, PREVIEW_LIMIT)} of {rows.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  {header.map((h) => (
                    <th key={h} className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-2 font-medium">Issue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((r) => (
                  <tr
                    key={r.line}
                    className={`border-b border-border/50 last:border-0 ${
                      r.error ? "bg-high/10" : ""
                    }`}
                  >
                    {header.map((_, i) => (
                      <td key={i} className="px-4 py-2">
                        {r.values[i] ?? ""}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-xs text-high">
                      {r.error ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between border-t border-border px-5 py-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
            >
              ← Choose another file
            </button>
            <button
              onClick={confirm}
              disabled={uploading || valid === 0}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Importing…" : `Import ${valid} customers`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-3 font-medium">
            Imported {result.imported} new · updated {result.updated} existing
          </p>
          {result.errors.length > 0 && (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-high/30 bg-high/10 p-3 text-left text-xs">
              <p className="mb-1 font-medium text-high">
                {result.errors.length} rows skipped:
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-muted">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
          >
            Go to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
