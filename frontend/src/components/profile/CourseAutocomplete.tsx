"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { Meta } from "@/types/api";

/**
 * CourseAutocomplete — premium searchable course picker over the full
 * course library (names + synonyms + abbreviations, fuzzy-tolerant).
 * Keyboard: ↑/↓ navigate, Enter select, Esc close. Free text allowed.
 * Unsupported disciplines are selectable but visibly flagged, so the
 * platform stays honest about coverage.
 */
export function CourseAutocomplete({
  meta,
  value,
  onChange,
}: {
  meta: Meta;
  value: string;
  onChange: (course: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setQuery(value), [value]);

  // simple fuzzy: subsequence match for typo tolerance
  const fuzzy = (needle: string, hay: string) => {
    let i = 0;
    for (const ch of hay) if (ch === needle[i]) i++;
    return i === needle.length;
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lib = meta.courseLibrary;
    if (!q) return lib.slice(0, 12);
    const scored = lib
      .map((c) => {
        const names = [c.name, ...c.aliases].map((n) => n.toLowerCase());
        let score = -1;
        if (names.some((n) => n === q)) score = 100;
        else if (names.some((n) => n.startsWith(q))) score = 80;
        else if (names.some((n) => n.includes(q))) score = 60;
        else if (q.length >= 3 && names.some((n) => fuzzy(q, n))) score = 30;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.c.supported) - Number(a.c.supported));
    return scored.slice(0, 10).map((x) => x.c);
  }, [meta.courseLibrary, query]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const select = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const matchedAlias = (c: { name: string; aliases: string[] }) => {
    const q = query.trim().toLowerCase();
    if (!q || c.name.toLowerCase().includes(q)) return null;
    return c.aliases.find((a) => a.toLowerCase().includes(q)) ?? null;
  };

  return (
    <div ref={rootRef} className={cn("relative", open && "z-50")}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          className={cn(inputClass, "pl-10 pr-9")}
          role="combobox"
          aria-expanded={open}
          aria-controls="course-listbox"
          aria-autocomplete="list"
          placeholder="Search any course — e.g. CS, AI, MBA, Psychology…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value); // free text always allowed
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              select(matches[active].name);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear course"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-red"
            onClick={() => {
              setQuery("");
              onChange("");
              setOpen(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul
          id="course-listbox"
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-line-strong bg-[#0d1526] p-1.5 shadow-raised"
        >
          {matches.map((c, i) => {
            const alias = matchedAlias(c);
            return (
              <li key={c.name} data-idx={i} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === active ? "bg-blue-wash text-blue-deep" : "hover:bg-white/10"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(c.name)}
                >
                  {value === c.name ? (
                    <Check className="h-4 w-4 flex-none text-green" aria-hidden />
                  ) : (
                    <span className="w-4 flex-none" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{c.name}</span>
                    {alias && <span className="ml-2 text-xs text-ink-faint">matches “{alias}”</span>}
                  </span>
                  {!c.supported && (
                    <span className="tag tag-amber flex-none text-[10px]">Not covered yet</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
