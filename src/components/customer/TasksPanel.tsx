"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

export interface TaskItem {
  id: string;
  title: string;
  status: "OPEN" | "DONE";
  outcome: "PENDING" | "SAVED" | "CHURNED";
  dueDate: string | null;
  completedAt: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
}

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand";

export function TasksPanel({
  customerId,
  tasks,
  canEdit,
}: {
  customerId: string;
  tasks: TaskItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const open = tasks.filter((t) => t.status === "OPEN");
  const done = tasks.filter((t) => t.status === "DONE");

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate: dueDate || undefined,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDueDate("");
        setShowAdd(false);
        toast("Intervention added.");
        router.refresh();
      } else {
        toast("Could not add task.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: string, outcome: "SAVED" | "CHURNED") {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE", outcome }),
    });
    setCompleting(null);
    if (res.ok) {
      toast(outcome === "SAVED" ? "Marked saved. 🎉" : "Marked churned.");
      router.refresh();
    } else {
      toast("Could not complete task.", "error");
    }
  }

  async function reopen(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OPEN" }),
    });
    if (res.ok) router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Task deleted.");
      router.refresh();
    }
  }

  const overdue = (t: TaskItem) =>
    t.dueDate !== null && new Date(t.dueDate).getTime() < Date.now();

  return (
    <div className="space-y-4">
      {canEdit && (
        <div>
          {showAdd ? (
            <form onSubmit={createTask} className="flex flex-wrap gap-2">
              <input
                autoFocus
                className={`${input} min-w-40 flex-1`}
                placeholder="e.g. Call the champion about renewal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                type="date"
                className={input}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <button
                type="submit"
                disabled={saving || title.trim() === ""}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
            >
              + New intervention
            </button>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          glyph="🎯"
          title="No interventions yet"
          hint="Track save attempts here — calls, discounts, check-ins — and record whether they worked."
        />
      ) : (
        <div className="space-y-2">
          {open.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface-2/40 p-3 text-sm"
            >
              {canEdit && (
                <button
                  onClick={() =>
                    setCompleting(completing === t.id ? null : t.id)
                  }
                  aria-label="Complete task"
                  className="h-4 w-4 shrink-0 rounded-full border border-border transition hover:border-brand"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted">
                  {t.assignee?.name ?? t.assignee?.email ?? "Unassigned"}
                  {t.dueDate && (
                    <span className={overdue(t) ? " text-high" : ""}>
                      {" · due "}
                      {new Date(t.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {overdue(t) && " (overdue)"}
                    </span>
                  )}
                </p>
              </div>
              {completing === t.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => complete(t.id, "SAVED")}
                    className="rounded-lg border border-low/30 bg-low/15 px-3 py-1.5 text-xs font-medium text-low transition hover:opacity-80"
                  >
                    ✅ Saved
                  </button>
                  <button
                    onClick={() => complete(t.id, "CHURNED")}
                    className="rounded-lg border border-high/30 bg-high/15 px-3 py-1.5 text-xs font-medium text-high transition hover:opacity-80"
                  >
                    💔 Churned
                  </button>
                </div>
              ) : (
                canEdit && (
                  <button
                    onClick={() => remove(t.id)}
                    aria-label="Delete task"
                    className="text-xs text-muted transition hover:text-high"
                  >
                    ×
                  </button>
                )
              )}
            </div>
          ))}

          {done.length > 0 && (
            <>
              {open.length > 0 && (
                <p className="pt-2 text-xs uppercase tracking-wide text-muted">
                  Completed
                </p>
              )}
              {done.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 p-3 text-sm opacity-70"
                >
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px]">
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-through">{t.title}</p>
                    <p className="text-xs text-muted">
                      {t.completedAt ? timeAgo(t.completedAt) : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      t.outcome === "SAVED"
                        ? "border-low/30 bg-low/15 text-low"
                        : t.outcome === "CHURNED"
                          ? "border-high/30 bg-high/15 text-high"
                          : "border-border text-muted"
                    }`}
                  >
                    {t.outcome}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => reopen(t.id)}
                      className="text-xs text-muted transition hover:text-foreground"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
