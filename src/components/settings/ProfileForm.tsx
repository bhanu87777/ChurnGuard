"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

const input =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand";

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast("Profile updated.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Update failed.", "error");
      }
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      toast("New passwords don't match.", "error");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pw.current,
          newPassword: pw.next,
        }),
      });
      if (res.ok) {
        toast("Password changed.");
        setPw({ current: "", next: "", confirm: "" });
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Password change failed.", "error");
      }
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <>
      <form
        onSubmit={saveName}
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="mb-3 font-medium">Display name</h2>
        <div className="flex gap-2">
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <button
            type="submit"
            disabled={savingName}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <form
        onSubmit={savePassword}
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="mb-3 font-medium">Change password</h2>
        <div className="space-y-3">
          <input
            className={input}
            type="password"
            placeholder="Current password"
            required
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <input
            className={input}
            type="password"
            placeholder="New password (min 6 characters)"
            required
            minLength={6}
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <input
            className={input}
            type="password"
            placeholder="Confirm new password"
            required
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <button
            type="submit"
            disabled={savingPw}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {savingPw ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </>
  );
}
