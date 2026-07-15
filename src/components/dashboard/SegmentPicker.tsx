"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface SegmentSummary {
  id: string;
  name: string;
  definition: {
    query?: string;
    bands?: string[];
    tagIds?: string[];
  };
}

// Applies/saves dashboard filters as named segments. The dashboard's filter
// state (search, band, tag) maps to a subset of the segment definition.
export function SegmentPicker({
  segments,
  selectedId,
  dirty,
  canEdit,
  onApply,
  onDeleted,
  onSaved,
  currentDefinition,
}: {
  segments: SegmentSummary[];
  selectedId: string | null;
  dirty: boolean;
  canEdit: boolean;
  onApply: (segment: SegmentSummary | null) => void;
  onDeleted: (id: string) => void;
  onSaved: () => void;
  currentDefinition: SegmentSummary["definition"];
}) {
  const { toast } = useToast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, definition: currentDefinition }),
      });
      if (res.ok) {
        toast(`Segment "${trimmed}" saved.`);
        setNaming(false);
        setName("");
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Could not save segment.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Segment deleted.");
      onDeleted(id);
    } else {
      toast("Could not delete segment.", "error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId ?? ""}
        onChange={(e) => {
          const seg = segments.find((s) => s.id === e.target.value) ?? null;
          onApply(seg);
        }}
        className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
      >
        <option value="">All customers</option>
        {segments.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {canEdit && selectedId && !dirty && (
        <button
          onClick={() => remove(selectedId)}
          aria-label="Delete segment"
          className="text-xs text-muted transition hover:text-high"
        >
          delete
        </button>
      )}

      {canEdit &&
        dirty &&
        (naming ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setNaming(false);
              }}
              placeholder="Segment name…"
              className="w-36 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-brand"
            />
            <button
              onClick={save}
              disabled={saving || name.trim() === ""}
              className="rounded-lg bg-brand px-2 py-1.5 text-xs font-medium text-brand-fg disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
          </span>
        ) : (
          <button
            onClick={() => setNaming(true)}
            className="whitespace-nowrap text-xs text-muted transition hover:text-foreground"
          >
            Save as segment…
          </button>
        ))}
    </div>
  );
}
