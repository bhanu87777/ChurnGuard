"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EVENT_TYPES = [
  { value: "LOGIN", label: "🔓 Login" },
  { value: "FEATURE_USE", label: "🧩 Feature use" },
  { value: "SUPPORT_TICKET", label: "🎫 Support ticket" },
  { value: "PAYMENT", label: "💳 Payment" },
  { value: "PAYMENT_FAILED", label: "⚠️ Payment failed" },
  { value: "NPS_RESPONSE", label: "📊 NPS response" },
];

// Log a new activity event, then immediately re-score so you can watch the risk
// change live — the money demo moment.
export function LogEventForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [type, setType] = useState("PAYMENT_FAILED");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function logAndScore(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFlash(null);
    try {
      const meta =
        type === "NPS_RESPONSE"
          ? { score: 4 }
          : type === "SUPPORT_TICKET"
            ? { priority: "high" }
            : undefined;
      await fetch(`/api/customers/${customerId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, metadata: meta }),
      });
      await fetch(`/api/customers/${customerId}/score`, { method: "POST" });
      setFlash("Event logged and risk re-scored.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={logAndScore}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="mb-1 font-medium">Log activity</h2>
      <p className="mb-3 text-xs text-muted">
        Simulate an incoming event, then re-score to see risk move.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Log & re-score"}
        </button>
      </div>
      {flash && <p className="mt-2 text-xs text-low">{flash}</p>}
    </form>
  );
}
