"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

export interface NoteItem {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
}

export function NotesPanel({
  customerId,
  notes,
  selfId,
  canEdit,
  isAdmin,
}: {
  customerId: string;
  notes: NoteItem[];
  selfId: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setBody("");
        toast("Note added.");
        router.refresh();
      } else {
        toast("Could not add note.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Note deleted.");
      router.refresh();
    } else {
      toast("Could not delete note.", "error");
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            rows={2}
            placeholder="Add context for the next teammate… (Ctrl+Enter to save)"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || body.trim() === ""}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add note"}
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <EmptyState
          glyph="📝"
          title="No notes yet"
          hint="Capture renewal context, stakeholder changes, or anything the next teammate should know."
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-border/60 bg-surface-2/40 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted">
                  {n.author?.name ?? n.author?.email ?? "Former teammate"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {timeAgo(n.createdAt)}
                  {(isAdmin || n.author?.id === selfId) && (
                    <button
                      onClick={() => remove(n.id)}
                      aria-label="Delete note"
                      className="transition hover:text-high"
                    >
                      ×
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
