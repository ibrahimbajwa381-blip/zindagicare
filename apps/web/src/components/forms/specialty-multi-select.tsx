"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import {
  cn,
  MAX_ADDITIONAL_SPECIALTIES,
  SPECIALTIES_ALPHABETICAL,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";

type SpecialtyMultiSelectProps = {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  exclude?: readonly string[];
  max?: number;
  className?: string;
  placeholder?: string;
  options?: readonly string[];
};

export function SpecialtyMultiSelect({
  id,
  values,
  onChange,
  exclude = [],
  max = MAX_ADDITIONAL_SPECIALTIES,
  className,
  placeholder = "Add additional specialties",
  options: optionsProp = SPECIALTIES_ALPHABETICAL,
}: SpecialtyMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);
  const selectedSet = useMemo(() => new Set(values), [values]);
  const atLimit = values.length >= max;

  const options = useMemo(() => {
    return optionsProp.filter(
      (item) => !excludeSet.has(item) && !selectedSet.has(item),
    );
  }, [optionsProp, excludeSet, selectedSet]);

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

  function addSpecialty(item: string) {
    if (atLimit || selectedSet.has(item) || excludeSet.has(item)) return;
    onChange([...values, item]);
    setQuery("");
    if (values.length + 1 >= max) {
      setOpen(false);
    }
  }

  function removeSpecialty(item: string) {
    onChange(values.filter((value) => value !== item));
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-2", className)}>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {item}
              <button
                type="button"
                onClick={() => removeSpecialty(item)}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        id={id}
        type="button"
        variant="outline"
        size="sm"
        disabled={atLimit}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full justify-start sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        {atLimit ? `Maximum ${max} additional` : placeholder}
      </Button>

      {open && !atLimit && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
            aria-label="Additional specialties"
            className="max-h-60 overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">
                {options.length === 0
                  ? "No more specialties available."
                  : `No specialty matches “${query.trim()}”.`}
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item} role="option">
                  <button
                    type="button"
                    onClick={() => addSpecialty(item)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                  >
                    <Check className="h-4 w-4 shrink-0 opacity-0" aria-hidden />
                    <span className="truncate">{item}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
