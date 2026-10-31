"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PAKISTAN_CITIES } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  KIND_LABELS,
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
  PLANNING_KINDS,
  PLANNING_PRIORITIES,
  PLANNING_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUGGESTED_COST_CATEGORIES,
  SUGGESTED_TARGET_METRICS,
  currentMonthKey,
  type PartnerStage,
  type PartnerType,
  type PlanningItemRow,
  type PlanningKind,
  type PlanningPriority,
  type PlanningStatus,
} from "@/features/admin/lib/planning";

export const planningSelectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:text-sm";

const textareaClass =
  "min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:rounded-lg sm:text-sm";

type FormState = {
  kind: PlanningKind;
  title: string;
  description: string;
  city: string;
  status: PlanningStatus;
  priority: PlanningPriority;
  owner: string;
  startDate: string;
  dueDate: string;
  month: string;
  metric: string;
  unit: string;
  targetValue: string;
  currentValue: string;
  partnerType: PartnerType | "";
  stage: PartnerStage | "";
  contactName: string;
  contactPhone: string;
  achievedAt: string;
  budget: string;
};

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function toFormState(kind: PlanningKind, item?: PlanningItemRow): FormState {
  return {
    kind: item?.kind ?? kind,
    title: item?.title ?? "",
    description: item?.description ?? "",
    city: item?.city ?? "",
    status: item?.status ?? (kind === "expense" ? "in_progress" : "planned"),
    priority: item?.priority ?? "medium",
    owner: item?.owner ?? "",
    startDate: item?.startDate ?? "",
    dueDate: item?.dueDate ?? "",
    month: item?.month ?? (kind === "target" ? currentMonthKey() : ""),
    metric: item?.metric ?? "",
    unit: item?.unit ?? "",
    targetValue: item?.targetValue != null ? String(item.targetValue) : "",
    currentValue: item?.currentValue != null ? String(item.currentValue) : "",
    partnerType: item?.partnerType ?? (kind === "partnership" ? "hospital" : ""),
    stage: item?.stage ?? (kind === "partnership" ? "prospect" : ""),
    contactName: item?.contactName ?? "",
    contactPhone: item?.contactPhone ?? "",
    achievedAt: item?.achievedAt ?? (kind === "achievement" ? todayKey() : ""),
    budget: item?.budget != null ? String(item.budget) : "",
  };
}

const optionalNumber = (v: string) => (v.trim() === "" ? undefined : Number(v));
const optionalString = (v: string) => v.trim() || undefined;

/** Request body for a create or full edit; only the fields that apply to the kind are sent. */
function toRequestBody(form: FormState) {
  const k = form.kind;
  return {
    kind: k,
    title: form.title.trim(),
    description: optionalString(form.description),
    city: optionalString(form.city),
    status: form.status,
    priority: form.priority,
    owner: optionalString(form.owner),
    startDate: k !== "achievement" ? optionalString(form.startDate) : undefined,
    dueDate: k !== "achievement" ? optionalString(form.dueDate) : undefined,
    month: k === "target" ? optionalString(form.month) : undefined,
    metric: k === "target" || k === "expense" ? optionalString(form.metric) : undefined,
    unit: k === "target" ? optionalString(form.unit) : undefined,
    targetValue: k === "target" ? optionalNumber(form.targetValue) : undefined,
    currentValue: k === "target" ? optionalNumber(form.currentValue) : undefined,
    partnerType: k === "partnership" && form.partnerType ? form.partnerType : undefined,
    stage: k === "partnership" && form.stage ? form.stage : undefined,
    contactName: k === "partnership" ? optionalString(form.contactName) : undefined,
    contactPhone: k === "partnership" ? optionalString(form.contactPhone) : undefined,
    achievedAt: k === "achievement" ? optionalString(form.achievedAt) : undefined,
    budget: k === "campaign" || k === "expense" ? optionalNumber(form.budget) : undefined,
  };
}

/** Same body for an existing row — used for quick inline edits like updating progress. */
export function rowToRequestBody(item: PlanningItemRow, patch: Partial<PlanningItemRow> = {}) {
  const merged = { ...item, ...patch };
  return toRequestBody(toFormState(merged.kind, merged));
}

export async function savePlanningItem(id: string | null, body: unknown) {
  const res = await fetch(id ? `/api/v1/admin/planning/${id}` : "/api/v1/admin/planning", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Could not save");
  }
}

export function PlanningItemForm({
  kind,
  item,
  onSaved,
  onClose,
}: {
  kind: PlanningKind;
  item?: PlanningItemRow;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(kind, item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  const k = form.kind;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.title.trim().length < 2) {
      setError("Give it a title");
      return;
    }
    if (k === "target" && (!form.month || !(Number(form.targetValue) > 0))) {
      setError("A target needs a month and a target number above zero");
      return;
    }
    if (k === "expense" && !(Number(form.budget) > 0)) {
      setError("Set the monthly amount");
      return;
    }
    setSaving(true);
    try {
      await savePlanningItem(item?.id ?? null, toRequestBody(form));
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {item ? "Edit" : "Add"} {KIND_LABELS[k].singular.toLowerCase()}
            </h2>
            <p className="text-sm text-slate-500">{KIND_LABELS[k].hint}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!item && (
            <div>
              <Label htmlFor="pl-kind">Type</Label>
              <select
                id="pl-kind"
                className={planningSelectClass}
                value={k}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...toFormState(e.target.value as PlanningKind),
                    title: prev.title,
                    description: prev.description,
                    city: prev.city,
                    owner: prev.owner,
                  }))
                }
              >
                {PLANNING_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {KIND_LABELS[value].singular}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={item ? "sm:col-span-2" : undefined}>
            <Label htmlFor="pl-title">
              {k === "partnership" ? "Hospital / organisation name" : "Title"}
            </Label>
            <Input
              id="pl-title"
              value={form.title}
              maxLength={200}
              placeholder={
                k === "target"
                  ? "e.g. 500 new patients in Lahore"
                  : k === "partnership"
                    ? "e.g. Services Hospital"
                    : k === "achievement"
                      ? "e.g. 100th completed consultation"
                      : k === "expense"
                        ? "e.g. Vercel Pro hosting"
                        : undefined
              }
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          {k === "target" && (
            <>
              <div>
                <Label htmlFor="pl-month">Month</Label>
                <Input
                  id="pl-month"
                  type="month"
                  value={form.month}
                  onChange={(e) => update({ month: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-metric">What are we measuring?</Label>
                <Input
                  id="pl-metric"
                  list="pl-metric-options"
                  value={form.metric}
                  maxLength={120}
                  placeholder="e.g. New patients"
                  onChange={(e) => update({ metric: e.target.value })}
                />
                <datalist id="pl-metric-options">
                  {SUGGESTED_TARGET_METRICS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="pl-target">Target</Label>
                <Input
                  id="pl-target"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.targetValue}
                  onChange={(e) => update({ targetValue: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-current">Achieved so far</Label>
                <Input
                  id="pl-current"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.currentValue}
                  placeholder="0"
                  onChange={(e) => update({ currentValue: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-unit">Unit</Label>
                <Input
                  id="pl-unit"
                  value={form.unit}
                  maxLength={40}
                  placeholder="e.g. patients, PKR, doctors"
                  onChange={(e) => update({ unit: e.target.value })}
                />
              </div>
            </>
          )}

          {k === "partnership" && (
            <>
              <div>
                <Label htmlFor="pl-ptype">Organisation type</Label>
                <select
                  id="pl-ptype"
                  className={planningSelectClass}
                  value={form.partnerType}
                  onChange={(e) => update({ partnerType: e.target.value as PartnerType })}
                >
                  {PARTNER_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {PARTNER_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pl-stage">Stage</Label>
                <select
                  id="pl-stage"
                  className={planningSelectClass}
                  value={form.stage}
                  onChange={(e) => update({ stage: e.target.value as PartnerStage })}
                >
                  {PARTNER_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {PARTNER_STAGE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pl-contact">Contact person</Label>
                <Input
                  id="pl-contact"
                  value={form.contactName}
                  maxLength={120}
                  placeholder="Optional"
                  onChange={(e) => update({ contactName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-phone">Contact phone</Label>
                <Input
                  id="pl-phone"
                  value={form.contactPhone}
                  maxLength={40}
                  placeholder="Optional"
                  onChange={(e) => update({ contactPhone: e.target.value })}
                />
              </div>
            </>
          )}

          {k === "achievement" && (
            <div>
              <Label htmlFor="pl-achieved">Date achieved</Label>
              <Input
                id="pl-achieved"
                type="date"
                value={form.achievedAt}
                onChange={(e) => update({ achievedAt: e.target.value })}
              />
            </div>
          )}

          {k === "campaign" && (
            <div>
              <Label htmlFor="pl-budget">Budget (PKR)</Label>
              <Input
                id="pl-budget"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.budget}
                placeholder="Optional"
                onChange={(e) => update({ budget: e.target.value })}
              />
            </div>
          )}

          {k === "expense" && (
            <>
              <div>
                <Label htmlFor="pl-amount">Amount per month (PKR)</Label>
                <Input
                  id="pl-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.budget}
                  onChange={(e) => update({ budget: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-category">Category</Label>
                <Input
                  id="pl-category"
                  list="pl-category-options"
                  value={form.metric}
                  maxLength={120}
                  placeholder="e.g. Hosting & servers"
                  onChange={(e) => update({ metric: e.target.value })}
                />
                <datalist id="pl-category-options">
                  {SUGGESTED_COST_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="pl-city">City</Label>
            <Input
              id="pl-city"
              list="pl-city-options"
              value={form.city}
              maxLength={80}
              placeholder="Leave empty for nationwide"
              onChange={(e) => update({ city: e.target.value })}
            />
            <datalist id="pl-city-options">
              {PAKISTAN_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {k !== "achievement" && (
            <>
              <div>
                <Label htmlFor="pl-status">Status</Label>
                <select
                  id="pl-status"
                  className={planningSelectClass}
                  value={form.status}
                  onChange={(e) => update({ status: e.target.value as PlanningStatus })}
                >
                  {PLANNING_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pl-priority">Priority</Label>
                <select
                  id="pl-priority"
                  className={planningSelectClass}
                  value={form.priority}
                  onChange={(e) => update({ priority: e.target.value as PlanningPriority })}
                >
                  {PLANNING_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="pl-start">Start date</Label>
                <Input
                  id="pl-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => update({ startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pl-due">Due date</Label>
                <Input
                  id="pl-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => update({ dueDate: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="pl-owner">Owner</Label>
            <Input
              id="pl-owner"
              value={form.owner}
              maxLength={120}
              placeholder="Who is responsible?"
              onChange={(e) => update({ owner: e.target.value })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="pl-description">Details / notes</Label>
            <textarea
              id="pl-description"
              className={textareaClass}
              value={form.description}
              maxLength={4000}
              placeholder="Steps, context, outcome, next actions…"
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>
            {item ? "Save changes" : `Add ${KIND_LABELS[k].singular.toLowerCase()}`}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
