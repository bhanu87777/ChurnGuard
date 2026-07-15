"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_META,
  type ScoringWeights,
} from "@/lib/scoring-weights";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const KEYS = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[];

export function ScoringWeightsForm({
  initialWeights,
}: {
  initialWeights: ScoringWeights;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [weights, setWeights] = useState(initialWeights);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = KEYS.some((k) => weights[k] !== initialWeights[k]);

  function set(key: keyof ScoringWeights, value: number) {
    setWeights((w) => ({ ...w, [key]: value }));
  }

  async function save(next: ScoringWeights) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/scoring", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        toast("Scoring weights saved. Re-score to apply.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Save failed.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-medium">Heuristic scoring weights</h2>
        <p className="mt-1 text-sm text-muted">
          Tune how the built-in fallback scorer weighs each churn signal. These
          apply when no AI key is configured (or the AI call fails) — AI scoring
          reasons over the raw signals directly.
        </p>
      </div>

      <div className="divide-y divide-border/50 px-5">
        {KEYS.map((key) => {
          const meta = WEIGHT_META[key];
          return (
            <div key={key} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted">{meta.description}</p>
              </div>
              <input
                type="range"
                min={0}
                max={meta.max}
                value={weights[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                className="w-32"
              />
              <input
                type="number"
                min={0}
                max={meta.max}
                value={weights[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center text-sm outline-none focus:border-brand"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <button
          onClick={() => setConfirmReset(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          Reset to defaults
        </button>
        <button
          onClick={() => save(weights)}
          disabled={!dirty || saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : dirty ? "Save weights" : "Saved"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset scoring weights?"
        body="All weights return to their defaults. This takes effect on the next re-score."
        confirmLabel="Reset"
        busy={saving}
        onConfirm={async () => {
          setWeights({ ...DEFAULT_WEIGHTS });
          await save({ ...DEFAULT_WEIGHTS });
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
