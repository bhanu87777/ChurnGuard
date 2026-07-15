"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  customerId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const { status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=1");
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unread ?? 0);
      }
    } catch {
      // Polling failure is fine — try again next tick.
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [status, refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setItems(data.notifications ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setItems((xs) => xs.map((x) => ({ ...x, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.readAt) {
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).then(refreshCount);
    }
    if (n.customerId) router.push(`/customers/${n.customerId}`);
  }

  if (status !== "authenticated") return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label={`Notifications (${unread} unread)`}
        className="relative rounded-md px-2 py-1.5 text-muted transition hover:text-foreground"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-high px-1 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted transition hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState
                glyph="🔔"
                title="All caught up"
                hint="Alerts from your rules will show up here."
              />
            ) : (
              <ul className="divide-y divide-border/50">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`block w-full px-4 py-3 text-left transition hover:bg-surface-2 ${
                        n.readAt ? "" : "bg-surface-2/50"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {n.body}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 text-right">
            <Link
              href="/settings/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-muted transition hover:text-foreground"
            >
              Alert rules →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
