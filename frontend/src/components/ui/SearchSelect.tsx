"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SearchSelect — the universal premium dropdown, matching the course
 * autocomplete's look exactly: glass popover, inline search, keyboard
 * navigation (↑/↓/Enter/Esc), check on the selected row, rise animation.
 * Replaces every native <select> in the app.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchable,
  ariaLabel,
  className,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  searchable?: boolean;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useMemo(() => `listbox-${Math.random().toString(36).slice(2, 9)}`, []);

  const canSearch = searchable ?? options.length > 8;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(Math.max(0, options.indexOf(value)));
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, options, value]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && matches[active]) select(matches[active]);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", open && "z-50", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel ?? placeholder}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-line-strong bg-white/5 text-left text-sm backdrop-blur transition-all duration-200",
          "hover:border-blue/40 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/25",
          compact ? "px-3.5 py-2" : "px-3.5 py-2.5",
          value ? "text-ink" : "text-ink-faint"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          className={cn("h-4 w-4 flex-none text-blue-deep transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="animate-rise absolute z-50 mt-2 w-full min-w-[220px] overflow-hidden rounded-xl border border-line-strong bg-[#0d1526] shadow-raised">
          {canSearch && (
            <div className="relative border-b border-line bg-white/[0.03]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                ref={searchRef}
                className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                placeholder="Search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                aria-label="Filter options"
              />
            </div>
          )}
          <ul id={listboxId} role="listbox" ref={listRef} className="max-h-64 overflow-auto p-1.5">
            {matches.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-ink-faint">Nothing matches “{query}”.</li>
            )}
            {matches.map((o, i) => (
              <li key={o} data-idx={i} role="option" aria-selected={o === value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === active ? "bg-blue-wash text-blue-deep" : "hover:bg-white/10"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(o)}
                >
                  {o === value ? (
                    <Check className="h-4 w-4 flex-none text-green" aria-hidden />
                  ) : (
                    <span className="w-4 flex-none" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{o}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
