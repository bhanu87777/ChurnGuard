"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";

export interface RuleFormValue {
  name: string;
  conditionType: string;
  params: Record<string, unknown>;
  notifyInApp: boolean;
  notifyEmail: boolean;
  cooldownHours: number;
}

const CONDITION_TYPES = [
  { value: "BAND_BECOMES", label: "Risk band becomes…" },
  { value: "SCORE_CROSSES", label: "Score crosses a threshold" },
  { value: "MRR_AT_LEAST", label: "High-value account becomes at-risk" },
  { value: "EVENT_OCCURS", label: "An event occurs" },
  { value: "INACTIVITY_DAYS", label: "Inactive for N days" },
];

const EVENT_TYPES = [
  { value: "LOGIN", label: "🔓 Login" },
  { value: "FEATURE_USE", label: "🧩 Feature use" },
  { value: "SUPPORT_TICKET", label: "🎫 Support ticket" },
  { value: "PAYMENT", label: "💳 Payment" },
  { value: "PAYMENT_FAILED", label: "⚠️ Payment failed" },
  { value: "NPS_RESPONSE", label: "📊 NPS response" },
];

const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand";

export function AlertRuleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: {
    name: string;
    conditionType: string;
    params: Record<string, unknown>;
    notifyInApp: boolean;
    notifyEmail: boolean;
    cooldownHours: number;
  };
  onSave: (value: RuleFormValue) => Promise<boolean>;
  onCancel: () => void;
}) {
  const p = initial?.params ?? {};
  const [name, setName] = useState(initial?.name ?? "");
  const [conditionType, setConditionType] = useState(
    initial?.conditionType ?? "BAND_BECOMES",
  );
  const [band, setBand] = useState(String(p.band ?? "HIGH"));
  const [threshold, setThreshold] = useState(String(p.threshold ?? 70));
  const [direction, setDirection] = useState(String(p.direction ?? "ABOVE"));
  const [eventType, setEventType] = useState(String(p.eventType ?? "PAYMENT_FAILED"));
  const [days, setDays] = useState(String(p.days ?? 30));
  const [minMrr, setMinMrr] = useState(
    p.minMrr !== undefined ? String(p.minMrr) : "",
  );
  const [notifyInApp, setNotifyInApp] = useState(initial?.notifyInApp ?? true);
  const [notifyEmail, setNotifyEmail] = useState(initial?.notifyEmail ?? false);
  const [cooldownHours, setCooldownHours] = useState(
    String(initial?.cooldownHours ?? 24),
  );
  const [saving, setSaving] = useState(false);

  function buildParams(): Record<string, unknown> {
    const base: Record<string, unknown> = {};
    if (minMrr !== "" && conditionType !== "MRR_AT_LEAST") {
      base.minMrr = Number(minMrr);
    }
    switch (conditionType) {
      case "BAND_BECOMES":
        return { ...base, band };
      case "SCORE_CROSSES":
        return { ...base, threshold: Number(threshold), direction };
      case "MRR_AT_LEAST":
        return { minMrr: Number(minMrr || 500) };
      case "EVENT_OCCURS":
        return { ...base, eventType };
      case "INACTIVITY_DAYS":
        return { ...base, days: Number(days) };
      default:
        return base;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        conditionType,
        params: buildParams(),
        notifyInApp,
        notifyEmail,
        cooldownHours: Number(cooldownHours) || 24,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${input} min-w-48 flex-1`}
          placeholder="Rule name, e.g. “Enterprise account at risk”"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={input}
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value)}
        >
          {CONDITION_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {conditionType === "BAND_BECOMES" && (
          <select className={input} value={band} onChange={(e) => setBand(e.target.value)}>
            {["HIGH", "MEDIUM", "LOW"].map((b) => (
              <option key={b} value={b}>
                becomes {b}
              </option>
            ))}
          </select>
        )}

        {conditionType === "SCORE_CROSSES" && (
          <>
            <select
              className={input}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="ABOVE">rises above</option>
              <option value="BELOW">falls below</option>
            </select>
            <input
              className={`${input} w-24`}
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </>
        )}

        {conditionType === "MRR_AT_LEAST" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            MRR at least $
            <input
              className={`${input} w-28`}
              type="number"
              min={1}
              required
              value={minMrr}
              onChange={(e) => setMinMrr(e.target.value)}
            />
          </label>
        )}

        {conditionType === "EVENT_OCCURS" && (
          <select
            className={input}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}

        {conditionType === "INACTIVITY_DAYS" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            no login for
            <input
              className={`${input} w-20`}
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            days
          </label>
        )}

        {conditionType !== "MRR_AT_LEAST" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            · only if MRR ≥ $
            <input
              className={`${input} w-24`}
              type="number"
              min={0}
              placeholder="any"
              value={minMrr}
              onChange={(e) => setMinMrr(e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={notifyInApp} onChange={setNotifyInApp} label="In-app" />
          <span className="text-muted">In-app</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={notifyEmail} onChange={setNotifyEmail} label="Email" />
          <span className="text-muted">Email</span>
        </label>
        <label className="flex items-center gap-2 text-muted">
          Cooldown
          <input
            className={`${input} w-20`}
            type="number"
            min={1}
            max={720}
            value={cooldownHours}
            onChange={(e) => setCooldownHours(e.target.value)}
          />
          hours
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || name.trim() === ""}
            className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rule"}
          </button>
        </div>
      </div>
    </form>
  );
}
