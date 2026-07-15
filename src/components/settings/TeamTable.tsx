"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Switch } from "@/components/ui/Switch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

export interface TeamRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLES: Role[] = ["ADMIN", "ANALYST", "VIEWER"];
const input =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand";

export function TeamTable({
  users,
  selfId,
}: {
  users: TeamRow[];
  selfId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deactivating, setDeactivating] = useState<TeamRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchUser(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      toast("Team member updated.");
      router.refresh();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    toast(data.error ?? "Update failed.", "error");
    return false;
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    setBusy(true);
    try {
      await patchUser(deactivating.id, { isActive: false });
      setDeactivating(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-medium">
          Team <span className="text-muted">({users.length})</span>
        </h2>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          {showAdd ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {showAdd && (
        <AddUserForm
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-border/50 last:border-0 ${
                  u.isActive ? "" : "opacity-60"
                }`}
              >
                <td className="px-5 py-3">
                  <div className="font-medium">
                    {u.name ?? "—"}
                    {u.id === selfId && (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={u.role}
                    disabled={u.id === selfId}
                    onChange={(e) => patchUser(u.id, { role: e.target.value })}
                    className={`${input} py-1.5 disabled:opacity-50`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-muted">{timeAgo(u.createdAt)}</td>
                <td className="px-5 py-3">
                  <Switch
                    checked={u.isActive}
                    disabled={u.id === selfId}
                    label={`${u.email} active`}
                    onChange={(next) => {
                      if (next) patchUser(u.id, { isActive: true });
                      else setDeactivating(u);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deactivating !== null}
        title={`Deactivate ${deactivating?.name ?? deactivating?.email}?`}
        body="They will be signed out within a few minutes and can no longer log in. You can reactivate them anytime."
        confirmLabel="Deactivate"
        danger
        busy={busy}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ANALYST",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast("Team member added.");
        onDone();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Could not add user.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-2 gap-3 border-b border-border bg-surface-2/40 p-5 sm:grid-cols-5"
    >
      <input
        className={input}
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className={input}
        placeholder="Email"
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className={input}
        placeholder="Temp password"
        type="text"
        required
        minLength={6}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <select
        className={input}
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
      >
        {saving ? "…" : "Add"}
      </button>
    </form>
  );
}
