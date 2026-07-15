"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface TabDef {
  key: string;
  label: string;
  count?: number;
}

// URL-driven tabs (?tab=...) so views survive refresh and are shareable.
export function Tabs({
  tabs,
  param = "tab",
  children,
}: {
  tabs: TabDef[];
  param?: string;
  children: (activeKey: string) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(param) ?? tabs[0]?.key;
  const activeKey = tabs.some((t) => t.key === active) ? active : tabs[0]?.key;

  function select(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === tabs[0]?.key) params.delete(param);
    else params.set(param, key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={`-mb-px px-4 py-2.5 text-sm transition ${
              t.key === activeKey
                ? "border-b-2 border-brand font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs text-muted">({t.count})</span>
            )}
          </button>
        ))}
      </div>
      <div className="pt-4">{children(activeKey)}</div>
    </div>
  );
}
