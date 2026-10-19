"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@zindagi/shared";

export type SearchableOption = { value: string; group?: string };

type SearchableSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Names the list for screen readers, e.g. "Cities". */
  label: string;
  /** Offer the typed text as a choice when nothing in the list matches it. */
  allowCustom?: boolean;
  className?: string;
};

/**
 * Dropdown with a search box (same look as SpecialtySelect). Options can be
 * grouped; a value not in the list (legacy free text) stays shown and selected.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  label,
  allowCustom = false,
  className,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => {
    const known = options.some((o) => o.value.toLowerCase() === value.trim().toLowerCase());
    return value.trim() && !known ? [{ value }, ...options] : options;
  }, [options, value]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? allOptions.filter(
            (o) => o.value.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q),
          )
        : allOptions,
    [allOptions, q],
  );
  const customValue =
    allowCustom && q && !allOptions.some((o) => o.value.toLowerCase() === q) ? query.trim() : null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function select(next: string) {
    onChange(next);
    close();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition",
          "hover:border-slate-300 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25",
          !value && "text-slate-400",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  // Enter picks the first match so typing + Enter is enough.
                  e.preventDefault();
                  const first = filtered[0]?.value ?? customValue;
                  if (first) select(first);
                }}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label.toLowerCase()}`}
                autoComplete="off"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-light focus:bg-white focus:ring-2 focus:ring-brand-light/25"
              />
            </label>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.map((option, index) => {
              const selected = option.value === value;
              const showGroup = option.group && option.group !== filtered[index - 1]?.group;
              return (
                <li key={`${option.group ?? ""}:${option.value}`} role="option" aria-selected={selected}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {option.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => select(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                      selected ? "bg-brand/10 font-medium text-brand" : "text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    <Check
                      className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="truncate">{option.value}</span>
                  </button>
                </li>
              );
            })}
            {customValue && (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => select(customValue)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="truncate">Use “{customValue}”</span>
                </button>
              </li>
            )}
            {filtered.length === 0 && !customValue && (
              <li className="px-3 py-3 text-sm text-slate-500">No match for “{query.trim()}”.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
