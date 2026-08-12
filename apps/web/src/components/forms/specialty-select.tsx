"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn, isKnownSpecialty, SPECIALTIES_ALPHABETICAL } from "@zindagi/shared";

type SpecialtySelectProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  /** Keep an unknown legacy specialty selectable until the doctor picks a known one. */
  allowCustomValue?: boolean;
  /** Specialties to hide from the list (e.g. already chosen as additional). */
  exclude?: readonly string[];
  placeholder?: string;
};

export function SpecialtySelect({
  id,
  name,
  value,
  onChange,
  required = false,
  className,
  allowCustomValue = false,
  exclude = [],
  placeholder = "Select your specialty",
}: SpecialtySelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);

  const options = useMemo(() => {
    const base =
      allowCustomValue && value && !isKnownSpecialty(value)
        ? [value, ...SPECIALTIES_ALPHABETICAL]
        : [...SPECIALTIES_ALPHABETICAL];
    return base.filter((item) => item === value || !excludeSet.has(item));
  }, [allowCustomValue, excludeSet, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.toLowerCase().includes(q));
  }, [options, query]);

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
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function selectSpecialty(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
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
                placeholder="Search specialties…"
                autoComplete="off"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-light focus:bg-white focus:ring-2 focus:ring-brand-light/25"
              />
            </label>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Specialties"
            className="max-h-60 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">No specialty matches “{query.trim()}”.</li>
            ) : (
              filtered.map((item) => {
                const selected = item === value;
                return (
                  <li key={item} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => selectSpecialty(item)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                        selected
                          ? "bg-brand/10 font-medium text-brand"
                          : "text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{item}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
