import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Search = Promise<{ action?: string; actor?: string; page?: string }>;

export default async function AuditSettingsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings/profile");

  const { action, actor, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action;
  if (actor) where.actorEmail = { contains: actor, mode: "insensitive" };

  const [entries, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (actor) params.set("actor", actor);
    params.set("page", String(p));
    return `/settings/audit?${params.toString()}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-medium">
          Audit log <span className="text-muted">({total})</span>
        </h2>
      </div>

      {/* Plain GET form — no client state needed */}
      <form
        method="GET"
        className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3"
      >
        <select
          name="action"
          defaultValue={action ?? ""}
          className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <input
          name="actor"
          defaultValue={actor ?? ""}
          placeholder="Filter by actor email…"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          Apply
        </button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          glyph="📜"
          title="No audit entries match"
          hint="Actions like customer edits, re-scores, and settings changes are recorded here."
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {entries.map((e) => (
            <li key={e.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
                  {e.action}
                </span>
                <span className="text-muted">
                  {e.actorEmail ?? "system"}
                  {e.targetType && (
                    <>
                      {" → "}
                      {e.targetType}
                    </>
                  )}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {timeAgo(e.createdAt)}
                </span>
              </div>
              {e.metadata != null && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                    details
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs text-muted">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="text-muted hover:text-foreground">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageLink(page + 1)} className="text-muted hover:text-foreground">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
