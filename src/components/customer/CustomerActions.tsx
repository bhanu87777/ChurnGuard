"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerActions({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [scoring, setScoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function rescore() {
    setScoring(true);
    try {
      await fetch(`/api/customers/${customerId}/score`, { method: "POST" });
      router.refresh();
    } finally {
      setScoring(false);
    }
  }

  async function remove() {
    if (!confirm("Stop monitoring this customer? This deletes their data.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={rescore}
        disabled={scoring}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {scoring ? "Scoring…" : "⚡ Re-score"}
      </button>
      <button
        onClick={remove}
        disabled={deleting}
        className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-high/50 hover:text-high disabled:opacity-50"
      >
        {deleting ? "…" : "Delete"}
      </button>
    </div>
  );
}
