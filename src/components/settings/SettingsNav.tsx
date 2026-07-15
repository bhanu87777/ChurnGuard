"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const ITEMS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/alerts", label: "Alert rules" },
  { href: "/settings/scoring", label: "Scoring weights", adminOnly: true },
  { href: "/settings/team", label: "Team", adminOnly: true },
  { href: "/settings/api-keys", label: "API keys", adminOnly: true },
  { href: "/settings/audit", label: "Audit log", adminOnly: true },
];

export function SettingsNav({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.adminOnly || role === "ADMIN");

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
