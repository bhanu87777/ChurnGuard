"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NotificationBell } from "@/components/NotificationBell";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
];

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-fg">
              ⚡
            </span>
            <span>
              Churn<span className="text-brand">Guard</span>
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  pathname.startsWith(l.href)
                    ? "font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <NotificationBell />
          <Link
            href="/settings"
            aria-label="Settings"
            className={`rounded-md px-2 py-1.5 transition ${
              pathname.startsWith("/settings")
                ? "text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            ⚙️
          </Link>
          {session?.user?.email && (
            <span className="hidden text-muted sm:inline">
              {session.user.email}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-border px-3 py-1.5 text-muted transition hover:border-high/50 hover:text-high"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
