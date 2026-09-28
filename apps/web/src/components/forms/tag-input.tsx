"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@zindagi/shared";

type TagInputProps = {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  maxLength?: number;
  placeholder?: string;
  /** One-tap chips shown under the input (already-added ones are hidden). */
  suggestions?: readonly string[];
  className?: string;
};

/**
 * Free-text chip input: Enter / comma adds, Backspace on an empty field removes the
 * last chip, pasted comma lists are split, and text left in the box is committed on blur
 * so it isn't lost when the user clicks Save straight after typing.
 */
export function TagInput({
  id,
  values,
  onChange,
  max,
  maxLength = 60,
  placeholder = "Type and press Enter",
  suggestions = [],
  className,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const atLimit = values.length >= max;
  const lower = useMemo(() => new Set(values.map((v) => v.toLowerCase())), [values]);
  const remainingSuggestions = suggestions.filter((s) => !lower.has(s.toLowerCase()));

  function add(raw: string) {
    const next = [...values];
    const seen = new Set(lower);
    for (const part of raw.split(",")) {
      const tag = part.trim().slice(0, maxLength);
      if (!tag || seen.has(tag.toLowerCase()) || next.length >= max) continue;
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
    if (next.length !== values.length) onChange(next);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(values.filter((v) => v !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      remove(values[values.length - 1]);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5",
          "focus-within:border-brand-light focus-within:ring-2 focus-within:ring-brand-light/25",
        )}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(",")) add(value);
            else setDraft(value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          disabled={atLimit}
          maxLength={maxLength}
          placeholder={atLimit ? `Maximum ${max} reached` : placeholder}
          enterKeyHint="done"
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>

      {!atLimit && remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-light hover:bg-brand-muted/40 hover:text-brand-dark"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        {values.length}/{max} · Press Enter or comma to add.
      </p>
    </div>
  );
}
