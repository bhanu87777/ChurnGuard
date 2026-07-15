"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

export interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ label: string; plaintext: string } | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setNewKey({ label: data.label, plaintext: data.plaintext });
        setLabel("");
        router.refresh();
      } else {
        toast(data?.error ?? "Could not create key.", "error");
      }
    } finally {
      setCreating(false);
    }
  }

  async function confirmRevoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/keys/${revoking.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("API key revoked.");
        router.refresh();
      } else {
        toast("Could not revoke key.", "error");
      }
      setRevoking(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-medium">API keys</h2>
        <p className="mt-1 text-sm text-muted">
          Authenticate external systems posting events to{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            POST /api/ingest
          </code>{" "}
          with an{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            X-Api-Key
          </code>{" "}
          header. Body: {"{ email, type, metadata?, occurredAt? }"} or an array.
        </p>
      </div>

      <form onSubmit={create} className="flex gap-2 border-b border-border px-5 py-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Key label, e.g. “Segment webhook”"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={creating || label.trim() === ""}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "…" : "Create key"}
        </button>
      </form>

      {keys.length === 0 ? (
        <EmptyState
          glyph="🔑"
          title="No API keys yet"
          hint="Create one to start streaming activity events from your product or billing system."
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {keys.map((k) => (
            <li
              key={k.id}
              className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${
                k.revokedAt ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{k.label}</p>
                <p className="font-mono text-xs text-muted">{k.prefix}…</p>
              </div>
              <span className="text-xs text-muted">
                {k.revokedAt
                  ? `revoked ${timeAgo(k.revokedAt)}`
                  : k.lastUsedAt
                    ? `last used ${timeAgo(k.lastUsedAt)}`
                    : "never used"}
              </span>
              {!k.revokedAt && (
                <button
                  onClick={() => setRevoking(k)}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted transition hover:border-high/50 hover:text-high"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Reveal-once modal */}
      {newKey && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="font-medium">“{newKey.label}” created</h2>
            <p className="mt-2 text-sm text-muted">
              Copy this key now — <strong>you won’t see it again.</strong>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
                {newKey.plaintext}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKey.plaintext);
                  toast("Copied to clipboard.");
                }}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-muted transition hover:text-foreground"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setNewKey(null)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={revoking !== null}
        title={`Revoke “${revoking?.label}”?`}
        body="Requests using this key will start failing immediately. This cannot be undone."
        confirmLabel="Revoke"
        danger
        busy={busy}
        onConfirm={confirmRevoke}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}
