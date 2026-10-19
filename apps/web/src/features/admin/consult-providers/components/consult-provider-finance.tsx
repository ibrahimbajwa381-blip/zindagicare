"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Landmark,
  ListChecks,
  Pencil,
  Receipt,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { errorMessage, type ConsultProviderApi } from "@/features/admin/consult-providers/api";
import type { ConsultProviderKind } from "@/features/admin/consult-providers/config";
import { formatCurrency, formatDateTime, humanize } from "@/features/admin/consult-providers/format";
import { useConsultProviderAdmin } from "@/features/admin/consult-providers/hooks";
import type {
  ConsultProviderBankAccount,
  ConsultProviderFinance as FinanceData,
} from "@/features/admin/consult-providers/types";
import { StatTile } from "@/features/admin/consult-providers/components/shared";

const PAYOUT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

/** Earnings, bank account, payouts and per-appointment earning eligibility. */
export function ConsultProviderFinance({
  kind,
  providerId,
}: {
  kind: ConsultProviderKind;
  providerId: string;
}) {
  const { config, api } = useConsultProviderAdmin(kind);
  const [data, setData] = useState<FinanceData | null>(null);
  const [loadError, setLoadError] = useState<string>();

  /** Refetch after a payout / bank-account change or a manual retry. */
  const load = useCallback(async () => {
    try {
      setData(await api.finance(providerId));
      setLoadError(undefined);
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load finance details"));
    }
  }, [api, providerId]);

  useEffect(() => {
    // Ignore a stale response if the provider changes mid-request.
    let cancelled = false;
    api
      .finance(providerId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errorMessage(e, "Could not load finance details"));
      });
    return () => {
      cancelled = true;
    };
  }, [api, providerId]);

  if (loadError && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loadError}{" "}
        <button type="button" onClick={() => void load()} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <LoadingScreen message="Loading finance details…" size="md" />;

  const { singularLower } = config.labels;
  const { earnings, balanceDue } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total earned" value={formatCurrency(earnings.totalEarnings)} />
        <StatTile label="This month" value={formatCurrency(earnings.earningsThisMonth)} />
        <StatTile
          label="Balance due"
          value={formatCurrency(balanceDue)}
          hint={`${formatCurrency(data.totalPaidOut)} paid out so far`}
          accent={balanceDue > 0}
        />
        <StatTile
          label="Patients referred"
          value={String(data.provider.referredPatientCount)}
          hint={`Keeps ${earnings.effectiveOnlineCommissionPercent}% of consult fees`}
        />
      </div>

      <BankAccountCard
        api={api}
        providerId={providerId}
        providerLabel={singularLower}
        bankAccount={data.bankAccount}
        onSaved={load}
      />
      <PayoutCard
        api={api}
        providerId={providerId}
        providerLabel={singularLower}
        balanceDue={balanceDue}
        onPaid={load}
      />
      <PayoutHistory payouts={data.payouts} />
      <AppointmentsTable appointments={data.appointments} providerLabel={singularLower} />
    </div>
  );
}

function BankAccountCard({
  api,
  providerId,
  providerLabel,
  bankAccount,
  onSaved,
}: {
  api: ConsultProviderApi;
  providerId: string;
  providerLabel: string;
  bankAccount: ConsultProviderBankAccount | null;
  onSaved: () => Promise<void>;
}) {
  const hasAccount = Boolean(bankAccount?.accountNumber || bankAccount?.iban);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    accountTitle: bankAccount?.accountTitle ?? "",
    bankName: bankAccount?.bankName ?? "",
    accountNumber: bankAccount?.accountNumber ?? "",
    iban: bankAccount?.iban ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const field = (key: keyof typeof form) => ({
    id: `bank-${key}`,
    value: form[key],
    disabled: saving,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await api.updateBankAccount(providerId, {
        accountTitle: form.accountTitle.trim(),
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        iban: form.iban.trim() || undefined,
      });
      await onSaved();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to save bank account"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payout bank account</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Set by the {providerLabel} from their earnings page, or corrected here.
            </p>
          </div>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {hasAccount ? "Edit" : "Add"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bank-accountTitle">Account title</Label>
              <Input {...field("accountTitle")} minLength={2} maxLength={120} required />
            </div>
            <div>
              <Label htmlFor="bank-bankName">Bank name</Label>
              <Input {...field("bankName")} minLength={2} maxLength={120} required />
            </div>
            <div>
              <Label htmlFor="bank-accountNumber">Account number</Label>
              <Input {...field("accountNumber")} minLength={4} maxLength={40} required />
            </div>
            <div>
              <Label htmlFor="bank-iban">IBAN (optional)</Label>
              <Input {...field("iban")} maxLength={40} />
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save bank account"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : !hasAccount ? (
          <p className="text-sm text-amber-700">
            No bank account on file yet — the {providerLabel} hasn&apos;t added one.
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailRow label="Account title" value={bankAccount?.accountTitle} />
            <DetailRow label="Bank name" value={bankAccount?.bankName} />
            <DetailRow label="Account number" value={bankAccount?.accountNumber} />
            <DetailRow label="IBAN" value={bankAccount?.iban} />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutCard({
  api,
  providerId,
  providerLabel,
  balanceDue,
  onPaid,
}: {
  api: ConsultProviderApi;
  providerId: string;
  providerLabel: string;
  balanceDue: number;
  onPaid: () => Promise<void>;
}) {
  const [method, setMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!file) {
      setError("Upload a payment receipt");
      return;
    }
    if (
      !window.confirm(
        `Record a payout of ${formatCurrency(balanceDue)} to this ${providerLabel}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPaying(true);
    setError(undefined);
    setSuccess(false);
    try {
      await api.recordPayout(providerId, {
        amount: balanceDue,
        method,
        note: note.trim() || undefined,
        receipt: file,
      });
      setSuccess(true);
      setFile(null);
      setNote("");
      await onPaid();
    } catch (err) {
      setError(errorMessage(err, "Failed to record payout"));
    } finally {
      setPaying(false);
    }
  };

  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-base">Pay this {providerLabel}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Pays the full outstanding balance and stores the payment receipt.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {success && <p className="text-sm text-emerald-700">Payout recorded and receipt saved.</p>}
        {balanceDue <= 0 ? (
          <p className="text-sm text-emerald-700">Fully paid up — no balance due.</p>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              Amount to pay:{" "}
              <span className="font-semibold text-slate-900">{formatCurrency(balanceDue)}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="payout-method">Payment method</Label>
                <select
                  id="payout-method"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={paying}
                >
                  {PAYOUT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="payout-note">Note (optional)</Label>
                <Input
                  id="payout-note"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={paying}
                  placeholder="e.g. transfer reference"
                />
              </div>
            </div>
            <label
              htmlFor="payout-receipt"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-muted/30"
            >
              <Upload className="h-5 w-5 text-brand" />
              <span className="text-sm font-medium text-slate-700">
                {file ? file.name : "Upload payment receipt (required) — JPG, PNG, WebP or PDF, up to 5 MB"}
              </span>
              <input
                id="payout-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                disabled={paying}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={() => void submit()} disabled={paying}>
              {paying ? "Recording payout…" : `Pay ${formatCurrency(balanceDue)}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutHistory({ payouts }: { payouts: FinanceData["payouts"] }) {
  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Receipt className="h-5 w-5" />
        </div>
        <CardTitle className="text-base">Payout history</CardTitle>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <p className="text-sm text-slate-500">No payouts recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-slate-500">
                    {humanize(p.method)} · paid by {p.paidByName} · {formatDateTime(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                {p.receipt && (
                  <a
                    href={p.receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    View receipt
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentsTable({
  appointments,
  providerLabel,
}: {
  appointments: FinanceData["appointments"];
  providerLabel: string;
}) {
  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-base">Appointments &amp; earning eligibility</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Recent consults, with the reason each one did or didn&apos;t count toward earnings.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-sm text-slate-500">No appointments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Patient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 font-medium">Patient joined</th>
                  <th className="px-3 py-2 font-medium capitalize">{providerLabel} joined</th>
                  <th className="px-3 py-2 font-medium">Earning</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {formatDateTime(a.scheduledStart)}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {a.patientName}
                      {a.isReferred && (
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                          Referral
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{humanize(a.status)}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {a.amountPkr != null ? formatCurrency(a.amountPkr) : "—"}
                      {a.paymentStatus && (
                        <span className="ml-1 text-xs capitalize text-slate-400">
                          ({a.paymentStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <JoinedIcon joined={Boolean(a.patientJoinedAt)} />
                    </td>
                    <td className="px-3 py-3">
                      <JoinedIcon joined={Boolean(a.providerJoinedAt)} />
                    </td>
                    <td className="px-3 py-3">
                      {a.earningCounted ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          +{formatCurrency(a.earningAmount)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Not counted
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-xs text-slate-500">{a.reason}</td>
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

function JoinedIcon({ joined }: { joined: boolean }) {
  return joined ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Joined" />
  ) : (
    <XCircle className="h-4 w-4 text-slate-300" aria-label="Did not join" />
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all text-slate-900">{value || "—"}</dd>
    </div>
  );
}
