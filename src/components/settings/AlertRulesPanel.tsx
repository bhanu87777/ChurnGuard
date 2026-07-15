"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AlertRuleForm, type RuleFormValue } from "./AlertRuleForm";

export interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  conditionType: string;
  params: Record<string, unknown>;
  notifyInApp: boolean;
  notifyEmail: boolean;
  cooldownHours: number;
  fired: number;
}

// Client-safe copy of the rule summary used across the alerts UI.
export function describeRule(rule: {
  conditionType: string;
  params: Record<string, unknown>;
}): string {
  const p = rule.params as {
    band?: string;
    threshold?: number;
    direction?: string;
    eventType?: string;
    days?: number;
    minMrr?: number;
  };
  const mrrSuffix =
    p.minMrr && rule.conditionType !== "MRR_AT_LEAST" ? ` (MRR ≥ $${p.minMrr})` : "";
  switch (rule.conditionType) {
    case "BAND_BECOMES":
      return `Risk band becomes ${p.band}${mrrSuffix}`;
    case "SCORE_CROSSES":
      return `Score crosses ${p.direction === "BELOW" ? "below" : "above"} ${p.threshold}${mrrSuffix}`;
    case "MRR_AT_LEAST":
      return `Account worth ≥ $${p.minMrr}/mo becomes at-risk`;
    case "EVENT_OCCURS":
      return `${String(p.eventType ?? "").replaceAll("_", " ").toLowerCase()} event occurs${mrrSuffix}`;
    case "INACTIVITY_DAYS":
      return `No login for ${p.days}+ days${mrrSuffix}`;
    default:
      return rule.conditionType;
  }
}

export function AlertRulesPanel({
  rules,
  isAdmin,
}: {
  rules: RuleRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<RuleRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<RuleRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(rule: RuleRow, enabled: boolean) {
    const res = await fetch(`/api/alert-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      toast(enabled ? "Rule enabled." : "Rule paused.");
      router.refresh();
    } else {
      toast("Could not update rule.", "error");
    }
  }

  async function save(value: RuleFormValue) {
    const isNew = editing === "new";
    const res = await fetch(
      isNew ? "/api/alert-rules" : `/api/alert-rules/${(editing as RuleRow).id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      },
    );
    if (res.ok) {
      toast(isNew ? "Rule created." : "Rule updated.");
      setEditing(null);
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    toast(data.error ?? "Could not save rule.", "error");
    return false;
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/alert-rules/${deleting.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Rule deleted.");
        router.refresh();
      } else {
        toast("Could not delete rule.", "error");
      }
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-medium">Alert rules</h2>
          <p className="mt-1 text-sm text-muted">
            Fire in-app (and optional email) alerts when customers cross risk
            thresholds, go quiet, or hit billing trouble. No AI involved — plain
            transparent rules.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing(editing === "new" ? null : "new")}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
          >
            {editing === "new" ? "Cancel" : "+ New rule"}
          </button>
        )}
      </div>

      {editing === "new" && (
        <div className="border-b border-border bg-surface-2/40 p-5">
          <AlertRuleForm onSave={save} onCancel={() => setEditing(null)} />
        </div>
      )}

      {rules.length === 0 && editing !== "new" ? (
        <EmptyState
          glyph="📣"
          title="No alert rules yet"
          hint="Create your first rule — e.g. “alert me when any account becomes HIGH risk.”"
          action={
            isAdmin ? (
              <button
                onClick={() => setEditing("new")}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
              >
                + New rule
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {rules.map((rule) => (
            <li key={rule.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Switch
                  checked={rule.enabled}
                  disabled={!isAdmin}
                  label={`${rule.name} enabled`}
                  onChange={(v) => toggle(rule, v)}
                />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${rule.enabled ? "" : "opacity-60"}`}>
                    {rule.name}
                  </p>
                  <p className="text-xs text-muted">
                    {describeRule(rule)} · cooldown {rule.cooldownHours}h ·{" "}
                    {[
                      rule.notifyInApp && "in-app",
                      rule.notifyEmail && "email",
                    ]
                      .filter(Boolean)
                      .join(" + ") || "no delivery"}
                    {rule.fired > 0 && ` · fired ${rule.fired}×`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditing(
                          editing !== "new" && editing?.id === rule.id
                            ? null
                            : rule,
                        )
                      }
                      className="text-xs text-muted transition hover:text-foreground"
                    >
                      {editing !== "new" && editing?.id === rule.id
                        ? "Cancel"
                        : "Edit"}
                    </button>
                    <button
                      onClick={() => setDeleting(rule)}
                      className="text-xs text-muted transition hover:text-high"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {editing !== "new" && editing?.id === rule.id && (
                <div className="mt-3 rounded-lg bg-surface-2/40 p-4">
                  <AlertRuleForm
                    initial={rule}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete rule “${deleting?.name}”?`}
        body="Past notifications stay, but this rule will stop firing."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
