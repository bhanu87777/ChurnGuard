"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RiskBand } from "@prisma/client";
import { RiskBadge } from "@/components/RiskBadge";
import { TagChip } from "@/components/TagChip";
import { useToast } from "@/components/ui/Toast";
import {
  SegmentPicker,
  type SegmentSummary,
} from "@/components/dashboard/SegmentPicker";
import { formatMoney } from "@/lib/utils";

export interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  plan: string;
  mrr: number;
  band: RiskBand | null;
  score: number | null;
  reason: string | null;
  eventCount: number;
  tags: { id: string; name: string; color: string }[];
}

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

const BAND_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW"] as const;

export function CustomerTable({
  customers,
  tags,
  segments,
  canEdit,
}: {
  customers: CustomerRow[];
  tags: TagOption[];
  segments: SegmentSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [scoring, setScoring] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<(typeof BAND_FILTERS)[number]>("ALL");
  const [tagId, setTagId] = useState<string>("ALL");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, Escape clears it — small keyboard polish.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = customers.filter((c) => {
    const matchesBand = band === "ALL" || c.band === band;
    const matchesTag = tagId === "ALL" || c.tags.some((t) => t.id === tagId);
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q === "" ||
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q);
    return matchesBand && matchesTag && matchesQuery;
  });

  // The current filters expressed as a segment definition (for save/apply/export).
  const currentDefinition = useMemo(() => {
    const def: SegmentSummary["definition"] = {};
    if (query.trim()) def.query = query.trim();
    if (band !== "ALL") def.bands = [band];
    if (tagId !== "ALL") def.tagIds = [tagId];
    return def;
  }, [query, band, tagId]);

  const selectedSegment = segments.find((s) => s.id === segmentId) ?? null;
  const dirty =
    JSON.stringify(currentDefinition) !==
    JSON.stringify(selectedSegment?.definition ?? {});
  const hasFilters = Object.keys(currentDefinition).length > 0;

  function applySegment(segment: SegmentSummary | null) {
    setSegmentId(segment?.id ?? null);
    const def = segment?.definition ?? {};
    setQuery(def.query ?? "");
    setBand(
      def.bands && def.bands.length === 1 &&
        (BAND_FILTERS as readonly string[]).includes(def.bands[0])
        ? (def.bands[0] as (typeof BAND_FILTERS)[number])
        : "ALL",
    );
    setTagId(def.tagIds && def.tagIds.length === 1 ? def.tagIds[0] : "ALL");
  }

  async function scoreAll() {
    setScoring(true);
    try {
      const res = await fetch("/api/score-all", { method: "POST" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(`Re-scored ${data.scored ?? "all"} customers.`);
      } else {
        toast("Re-score failed.", "error");
      }
      router.refresh();
    } finally {
      setScoring(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (band !== "ALL") params.set("band", band);
    if (query.trim()) params.set("q", query.trim());
    if (tagId !== "ALL") params.set("tag", tagId);
    const qs = params.toString();
    window.location.href = `/api/export/customers${qs ? `?${qs}` : ""}`;
    toast("Export started.");
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="font-medium">
          Customers{" "}
          <span className="text-muted">
            ({filtered.length}
            {filtered.length !== customers.length && ` of ${customers.length}`})
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button
                onClick={exportCsv}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
              >
                Export CSV
              </button>
              <Link
                href="/customers/import"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
              >
                Import CSV
              </Link>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
              >
                {showAdd ? "Cancel" : "+ Add customer"}
              </button>
              <button
                onClick={scoreAll}
                disabled={scoring}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
              >
                {scoring ? "Scoring…" : "⚡ Re-score all"}
              </button>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <AddCustomerForm
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}

      {/* Segments + search + band/tag filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <SegmentPicker
          segments={segments}
          selectedId={segmentId}
          dirty={dirty && hasFilters}
          canEdit={canEdit}
          onApply={applySegment}
          onDeleted={(id) => {
            if (segmentId === id) setSegmentId(null);
            router.refresh();
          }}
          onSaved={() => router.refresh()}
          currentDefinition={currentDefinition}
        />
        <div className="relative min-w-40 flex-1">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or company…"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 pr-8 text-sm outline-none focus:border-brand"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 text-[10px] text-muted">
            /
          </kbd>
        </div>
        {tags.length > 0 && (
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="ALL">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          {BAND_FILTERS.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                band === b
                  ? "bg-brand text-brand-fg"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">MRR</th>
              <th className="px-5 py-3 font-medium">Risk</th>
              <th className="px-5 py-3 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="cursor-pointer border-b border-border/50 transition last:border-0 hover:bg-surface-2"
              >
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{c.name}</span>
                    {c.tags.map((t) => (
                      <TagChip key={t.id} name={t.name} color={t.color} />
                    ))}
                  </div>
                  <div className="text-xs text-muted">
                    {c.company ?? "—"} · {c.eventCount} events
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">{c.plan}</td>
                <td className="px-5 py-3">{formatMoney(c.mrr)}</td>
                <td className="px-5 py-3">
                  {c.band ? (
                    <RiskBadge band={c.band} score={c.score ?? undefined} />
                  ) : (
                    <span className="text-xs text-muted">not scored</span>
                  )}
                </td>
                <td className="max-w-xs px-5 py-3 text-xs text-muted">
                  <span className="line-clamp-2">{c.reason ?? "—"}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted">
                  {customers.length === 0
                    ? "No customers yet. Add one or import a CSV to get started."
                    : "No customers match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddCustomerForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    plan: "PRO",
    mrr: "0",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, mrr: Number(form.mrr) }),
      });
      if (res.ok) {
        toast("Customer added.");
        onDone();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Could not add customer.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  const input =
    "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-2 gap-3 border-b border-border bg-surface-2/40 p-5 sm:grid-cols-5"
    >
      <input
        className={input}
        placeholder="Name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className={input}
        placeholder="Email"
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className={input}
        placeholder="Company"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
      />
      <select
        className={input}
        value={form.plan}
        onChange={(e) => setForm({ ...form, plan: e.target.value })}
      >
        {["FREE", "STARTER", "PRO", "ENTERPRISE"].map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          className={`${input} w-full`}
          placeholder="MRR"
          type="number"
          value={form.mrr}
          onChange={(e) => setForm({ ...form, mrr: e.target.value })}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
    </form>
  );
}
