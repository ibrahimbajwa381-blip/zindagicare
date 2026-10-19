"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { surfaceCard } from "@/lib/ui/surfaces";
import type {
  ManualEarningCollectedBy,
  ManualEarningProviderOption,
  ManualEarningProviderRole,
  ManualEarningRow,
  ManualEarningServiceType,
} from "@/server/services/admin-manual-earnings.service";

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

const SERVICE_LABELS: Record<ManualEarningServiceType, string> = {
  home_visit: "Home visit",
  online_consult: "Online consult",
  other: "Other",
};

const ROLE_LABELS: Record<ManualEarningProviderRole, string> = {
  doctor: "Doctor",
  physiotherapist: "Physiotherapist",
};

const selectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:text-sm";

function todayInKarachi() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

type FormState = {
  providerRole: ManualEarningProviderRole;
  providerProfileId: string;
  serviceType: ManualEarningServiceType;
  patientName: string;
  grossAmount: string;
  providerPercent: string;
  collectedBy: ManualEarningCollectedBy;
  occurredOn: string;
  note: string;
};

const initialForm = (): FormState => ({
  providerRole: "doctor",
  providerProfileId: "",
  serviceType: "home_visit",
  patientName: "",
  grossAmount: "",
  providerPercent: "",
  collectedBy: "provider",
  occurredOn: todayInKarachi(),
  note: "",
});

function ManualEarningForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [providers, setProviders] = useState<ManualEarningProviderOption[] | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/admin/platform-earnings/manual-entries")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) setProviders(json.data as ManualEarningProviderOption[]);
        else setError(json?.error?.message ?? "Could not load providers");
      })
      .catch(() => !cancelled && setError("Could not load providers"));
    return () => {
      cancelled = true;
    };
  }, []);

  const roleProviders = useMemo(
    () => (providers ?? []).filter((p) => p.role === form.providerRole),
    [providers, form.providerRole],
  );
  const selectedProvider = roleProviders.find((p) => p.profileId === form.providerProfileId);

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  // Prefill the provider's default split whenever the provider or service changes.
  const withDefaultPercent = (next: FormState): FormState => {
    const provider = (providers ?? []).find(
      (p) => p.role === next.providerRole && p.profileId === next.providerProfileId,
    );
    return {
      ...next,
      providerPercent: provider ? String(provider.defaultPercent[next.serviceType]) : "",
    };
  };

  const gross = Number(form.grossAmount);
  const percent = Number(form.providerPercent);
  const previewReady =
    form.grossAmount !== "" && form.providerPercent !== "" && gross > 0 && percent >= 0 && percent <= 100;
  const providerShare = previewReady ? Math.round((Math.round(gross) * percent) / 100) : 0;
  const platformShare = previewReady ? Math.round(gross) - providerShare : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.providerProfileId) {
      setError(`Pick a ${ROLE_LABELS[form.providerRole].toLowerCase()}`);
      return;
    }
    if (!previewReady) {
      setError("Enter the amount paid and the provider's share (0–100%)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/platform-earnings/manual-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerRole: form.providerRole,
          providerProfileId: form.providerProfileId,
          serviceType: form.serviceType,
          patientName: form.patientName.trim() || undefined,
          grossAmount: gross,
          providerPercent: percent,
          collectedBy: form.collectedBy,
          note: form.note.trim() || undefined,
          occurredAt: `${form.occurredOn}T12:00:00+05:00`,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Could not save the entry");
      }
      await onSaved();
      setForm(initialForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="me-role">Provider type</Label>
          <select
            id="me-role"
            className={selectClass}
            value={form.providerRole}
            onChange={(e) =>
              update({
                providerRole: e.target.value as ManualEarningProviderRole,
                providerProfileId: "",
                providerPercent: "",
              })
            }
          >
            <option value="doctor">Doctor</option>
            <option value="physiotherapist">Physiotherapist</option>
          </select>
        </div>
        <div>
          <Label htmlFor="me-provider">{ROLE_LABELS[form.providerRole]}</Label>
          <select
            id="me-provider"
            className={selectClass}
            value={form.providerProfileId}
            disabled={!providers}
            onChange={(e) =>
              setForm((prev) => withDefaultPercent({ ...prev, providerProfileId: e.target.value }))
            }
          >
            <option value="">{providers ? "Select…" : "Loading…"}</option>
            {roleProviders.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="me-service">Service</Label>
          <select
            id="me-service"
            className={selectClass}
            value={form.serviceType}
            onChange={(e) =>
              setForm((prev) =>
                withDefaultPercent({
                  ...prev,
                  serviceType: e.target.value as ManualEarningServiceType,
                }),
              )
            }
          >
            {Object.entries(SERVICE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="me-patient">Patient name</Label>
          <Input
            id="me-patient"
            value={form.patientName}
            maxLength={120}
            placeholder="Optional"
            onChange={(e) => update({ patientName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="me-amount">Amount patient paid (PKR)</Label>
          <Input
            id="me-amount"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.grossAmount}
            onChange={(e) => update({ grossAmount: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="me-percent">Provider&apos;s share (%)</Label>
          <Input
            id="me-percent"
            type="number"
            min={0}
            max={100}
            value={form.providerPercent}
            placeholder={selectedProvider ? undefined : "Pick a provider first"}
            onChange={(e) => update({ providerPercent: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="me-collected">Who received the money?</Label>
          <select
            id="me-collected"
            className={selectClass}
            value={form.collectedBy}
            onChange={(e) => update({ collectedBy: e.target.value as ManualEarningCollectedBy })}
          >
            <option value="provider">Provider (cash / direct transfer)</option>
            <option value="platform">ZindagiCare account</option>
          </select>
        </div>
        <div>
          <Label htmlFor="me-date">Date of service</Label>
          <Input
            id="me-date"
            type="date"
            max={todayInKarachi()}
            value={form.occurredOn}
            onChange={(e) => update({ occurredOn: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="me-note">Note</Label>
          <Input
            id="me-note"
            value={form.note}
            maxLength={500}
            placeholder="e.g. Booked via WhatsApp"
            onChange={(e) => update({ note: e.target.value })}
          />
        </div>
      </div>

      {previewReady && (
        <p className="text-sm text-slate-600">
          Provider keeps <span className="font-semibold">{formatCurrency(providerShare)}</span> ·
          ZindagiCare commission{" "}
          <span className="font-semibold text-slate-900">{formatCurrency(platformShare)}</span>
          {form.collectedBy === "provider"
            ? " — to be collected from the provider."
            : " — provider's share is added to what we owe them."}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>
          Save entry
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminManualEarnings({
  entries,
  totals,
  onChange,
}: {
  entries: ManualEarningRow[];
  totals: { grossRevenue: number; platformCommission: number; commissionHeldByProviders: number };
  onChange: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async (entry: ManualEarningRow) => {
    if (
      !window.confirm(
        `Delete this manual entry (${entry.providerName}, ${formatCurrency(entry.grossAmount)})? It will no longer count toward earnings.`,
      )
    ) {
      return;
    }
    setDeletingId(entry.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/admin/platform-earnings/manual-entries/${entry.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to delete entry");
      }
      await onChange();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Manual earnings (booked outside the app)</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Doctor or physiotherapist services arranged over WhatsApp or phone. These count
              toward the totals above.{" "}
              {entries.length > 0 && (
                <>
                  {formatCurrency(totals.grossRevenue)} collected ·{" "}
                  {formatCurrency(totals.platformCommission)} commission
                  {totals.commissionHeldByProviders > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-amber-700">
                        {formatCurrency(totals.commissionHeldByProviders)} held by providers
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Add earning
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="relative">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowForm(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <ManualEarningForm
              onSaved={async () => {
                await onChange();
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No manual entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium">Patient</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Provider share</th>
                  <th className="px-3 py-2 font-medium">Commission</th>
                  <th className="px-3 py-2 font-medium">Money with</th>
                  <th className="px-3 py-2 font-medium">Recorded by</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {new Date(entry.occurredAt).toLocaleDateString("en-PK", {
                        timeZone: "Asia/Karachi",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{entry.providerName}</p>
                      <p className="text-xs text-slate-500">{ROLE_LABELS[entry.providerRole]}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {SERVICE_LABELS[entry.serviceType]}
                      {entry.note && (
                        <p className="max-w-[16rem] text-xs text-slate-400">{entry.note}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{entry.patientName ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatCurrency(entry.grossAmount)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatCurrency(entry.providerEarnings)}
                      <span className="text-xs text-slate-400"> ({entry.providerPercent}%)</span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {formatCurrency(entry.platformCommission)}
                    </td>
                    <td className="px-3 py-3">
                      {entry.collectedBy === "provider" ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Provider
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          ZindagiCare
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{entry.recordedByName}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => remove(entry)}
                        disabled={deletingId === entry.id}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === entry.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
