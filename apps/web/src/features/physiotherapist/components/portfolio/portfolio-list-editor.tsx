"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn, PORTFOLIO_MIN_YEAR } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type DraftRow = Record<string, string | boolean>;

export type ListFieldDef = {
  key: string;
  label: string;
  kind: "text" | "year" | "number" | "textarea" | "checkbox" | "url";
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  /** Upper bound for `number` fields (lower bound is 0). */
  maxValue?: number;
  /** Span both grid columns on wider screens. */
  wide?: boolean;
  /** Hide (and ignore) the field for this row, e.g. end year while "current". */
  hidden?: (row: DraftRow) => boolean;
};

const MAX_YEAR = new Date().getFullYear() + 1;

type PortfolioListEditorProps = {
  rows: DraftRow[];
  onChange: (rows: DraftRow[]) => void;
  fields: ListFieldDef[];
  max: number;
  itemLabel: string;
  emptyRow: DraftRow;
};

/** Repeatable-row editor for experience, education, certifications and awards. */
export function PortfolioListEditor({
  rows,
  onChange,
  fields,
  max,
  itemLabel,
  emptyRow,
}: PortfolioListEditorProps) {
  const baseId = useId();

  function update(index: number, key: string, value: string | boolean) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          No {itemLabel.toLowerCase()} added yet.
        </p>
      )}

      {rows.map((row, index) => (
        <fieldset
          key={index}
          className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {itemLabel} {index + 1}
            </legend>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-8 sm:w-8"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-8 sm:w-8"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:bg-red-50 sm:h-8 sm:w-8"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              if (field.hidden?.(row)) return null;
              const id = `${baseId}-${index}-${field.key}`;
              const value = row[field.key];

              if (field.kind === "checkbox") {
                return (
                  <label
                    key={field.key}
                    className={cn(
                      "flex items-center gap-2 text-sm text-slate-700",
                      field.wide && "sm:col-span-2",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => update(index, field.key, e.target.checked)}
                    />
                    {field.label}
                  </label>
                );
              }

              return (
                <div key={field.key} className={cn(field.wide && "sm:col-span-2")}>
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  {field.kind === "textarea" ? (
                    <textarea
                      id={id}
                      rows={3}
                      maxLength={field.maxLength}
                      value={String(value ?? "")}
                      placeholder={field.placeholder}
                      onChange={(e) => update(index, field.key, e.target.value)}
                      className="mt-1 flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
                    />
                  ) : (
                    <Input
                      id={id}
                      type={field.kind === "year" || field.kind === "number" ? "number" : "text"}
                      inputMode={
                        field.kind === "year" || field.kind === "number"
                          ? "numeric"
                          : field.kind === "url"
                            ? "url"
                            : undefined
                      }
                      min={field.kind === "year" ? PORTFOLIO_MIN_YEAR : field.kind === "number" ? 0 : undefined}
                      max={field.kind === "year" ? MAX_YEAR : field.kind === "number" ? field.maxValue : undefined}
                      maxLength={field.maxLength}
                      value={String(value ?? "")}
                      placeholder={field.placeholder}
                      onChange={(e) => update(index, field.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { ...emptyRow }])}
        disabled={rows.length >= max}
      >
        <Plus className="h-4 w-4" />
        {rows.length >= max ? `Maximum ${max} reached` : `Add ${itemLabel.toLowerCase()}`}
      </Button>
    </div>
  );
}

/** Converts draft rows back to typed items; returns an error message on the first bad row. */
export function draftRowsToItems<T>(
  rows: DraftRow[],
  fields: ListFieldDef[],
  itemLabel: string,
): { items: T[]; error?: string } {
  const items: T[] = [];
  for (const [index, row] of rows.entries()) {
    const item: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.hidden?.(row)) continue;
      const raw = row[field.key];
      if (field.kind === "checkbox") {
        item[field.key] = Boolean(raw);
        continue;
      }
      const value = String(raw ?? "").trim();
      if (!value) {
        if (field.required) {
          return { items, error: `${itemLabel} ${index + 1}: ${field.label} is required.` };
        }
        continue;
      }
      if (field.kind === "year") {
        const year = Number(value);
        if (!Number.isInteger(year) || year < PORTFOLIO_MIN_YEAR || year > MAX_YEAR) {
          return {
            items,
            error: `${itemLabel} ${index + 1}: ${field.label} must be between ${PORTFOLIO_MIN_YEAR} and ${MAX_YEAR}.`,
          };
        }
        item[field.key] = year;
      } else if (field.kind === "number") {
        const amount = Number(value);
        const max = field.maxValue ?? Number.MAX_SAFE_INTEGER;
        if (!Number.isInteger(amount) || amount < 0 || amount > max) {
          return {
            items,
            error: `${itemLabel} ${index + 1}: ${field.label} must be a whole number between 0 and ${max.toLocaleString()}.`,
          };
        }
        item[field.key] = amount;
      } else if (field.kind === "url") {
        // Accept "example.com/cert" by assuming https, but reject anything that isn't a web link.
        const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)) {
          return {
            items,
            error: `${itemLabel} ${index + 1}: ${field.label} must be a valid web link.`,
          };
        }
        item[field.key] = url;
      } else {
        if (field.required && value.length < 2) {
          return { items, error: `${itemLabel} ${index + 1}: ${field.label} is too short.` };
        }
        item[field.key] = value;
      }
    }
    items.push(item as T);
  }
  return { items };
}

/** Typed items → editable string rows (numbers become strings, missing → ""). */
export function itemsToDraftRows<T extends object>(items: T[], fields: ListFieldDef[]): DraftRow[] {
  return items.map((item) => {
    const row: DraftRow = {};
    for (const field of fields) {
      const value = (item as Record<string, unknown>)[field.key];
      row[field.key] =
        field.kind === "checkbox" ? Boolean(value) : value === undefined ? "" : String(value);
    }
    return row;
  });
}
