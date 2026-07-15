"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TagChip } from "@/components/TagChip";
import { useToast } from "@/components/ui/Toast";

export interface TagInfo {
  id: string;
  name: string;
  color: string;
}

export function TagEditor({
  customerId,
  tags,
  canEdit,
}: {
  customerId: string;
  tags: TagInfo[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!adding) return;
    inputRef.current?.focus();
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllTags(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [adding]);

  async function setTagIds(tagIds: string[]) {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds }),
      });
      if (!res.ok) toast("Could not update tags.", "error");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    let tagId = existing?.id;
    if (!tagId) {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        toast("Could not create tag.", "error");
        return;
      }
      const tag = await res.json();
      tagId = tag.id;
    }
    setQuery("");
    setAdding(false);
    await setTagIds([...tags.map((t) => t.id), tagId!]);
  }

  const suggestions = allTags.filter(
    (t) =>
      !tags.some((x) => x.id === t.id) &&
      t.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip
          key={t.id}
          name={t.name}
          color={t.color}
          onRemove={
            canEdit
              ? () => setTagIds(tags.filter((x) => x.id !== t.id).map((x) => x.id))
              : undefined
          }
        />
      ))}
      {canEdit &&
        (adding ? (
          <span className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(query);
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setQuery("");
                }
              }}
              onBlur={() => setTimeout(() => setAdding(false), 150)}
              placeholder="Tag name…"
              className="w-32 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs outline-none focus:border-brand"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 top-7 z-20 w-40 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                {suggestions.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(t.name);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-surface-2"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            disabled={busy}
            className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted transition hover:border-brand hover:text-foreground disabled:opacity-50"
          >
            + tag
          </button>
        ))}
    </div>
  );
}
