"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export function CustomerActions({
  customerId,
  canRescore = true,
  canDelete = true,
}: {
  customerId: string;
  canRescore?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [scoring, setScoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function rescore() {
    setScoring(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/score`, {
        method: "POST",
      });
      if (res.ok) toast("Risk re-scored.");
      else toast("Re-score failed.", "error");
      router.refresh();
    } finally {
      setScoring(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("Delete failed.", "error");
        setConfirming(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (!canRescore && !canDelete) return null;

  return (
    <div className="flex gap-2">
      {canRescore && (
        <button
          onClick={rescore}
          disabled={scoring}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {scoring ? "Scoring…" : "⚡ Re-score"}
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => setConfirming(true)}
          disabled={deleting}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-high/50 hover:text-high disabled:opacity-50"
        >
          Delete
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Stop monitoring this customer?"
        body="This permanently deletes the customer along with their events, scores, notes, and tasks."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
