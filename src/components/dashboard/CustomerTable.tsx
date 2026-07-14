"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RiskBand } from "@prisma/client";
import { RiskBadge } from "@/components/RiskBadge";
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
}

const BAND_FILTERS = ["ALL", "HIGH", "MEDIUM", "LOW"] as const;

export function CustomerTable({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [scoring, setScoring] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<(typeof BAND_FILTERS)[number]>("ALL");

  const filtered = customers.filter((c) => {
    const matchesBand = band === "ALL" || c.band === band;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q === "" ||
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q);
    return matchesBand && matchesQuery;
  });

  async function scoreAll() {
    setScoring(true);
    try {
      await fetch("/api/score-all", { method: "POST" });
      router.refresh();
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="font-medium">
          Customers{" "}
          <span className="text-muted">
            ({filtered.length}
            {filtered.length !== customers.length && ` of ${customers.length}`})
          </span>
        </h3>
        <div className="flex gap-2">
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
        </div>
      </div>

      {showAdd && <AddCustomerForm onDone={() => { setShowAdd(false); router.refresh(); }} />}

      {/* Search + band filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or company…"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
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
                  <div className="font-medium">{c.name}</div>
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
                    ? "No customers yet. Add one to get started."
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
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, mrr: Number(form.mrr) }),
      });
      onDone();
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
