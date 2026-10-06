"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Landmark, Receipt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { AdminPhysiotherapistFinance as FinanceData } from "@/server/services/physiotherapist-finance.service";

const PAYOUT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-all text-slate-900">{value || "—"}</dd>
    </div>
  );
}

/** Admin: physiotherapist's payout bank account, Sunday payout form and payout history. */
export function AdminPhysiotherapistFinance({ staffProfileId }: { staffProfileId: string }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loadError, setLoadError] = useState<string>();

  const [method, setMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();
  const [paySuccess, setPaySuccess] = useState(false);

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      const res = await fetch(`/api/v1/admin/physiotherapists/${staffProfileId}/finance`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Could not load payout details");
      }
      setData(json.data as FinanceData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load payout details");
    }
  }, [staffProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitPayout = async () => {
    if (!data) return;
    if (!file) {
      setPayError("Upload a payment receipt");
      return;
    }
    setPaying(true);
    setPayError(undefined);
    setPaySuccess(false);

    const formData = new FormData();
    formData.append("amount", String(data.availableBalance));
    formData.append("method", method);
    if (note.trim()) formData.append("note", note.trim());
    formData.append("receipt", file);

    try {
      const res = await fetch(
        `/api/v1/admin/physiotherapists/${staffProfileId}/finance/payouts`,
        { method: "POST", body: formData },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to record payout");
      }
      setPaySuccess(true);
      setFile(null);
      setNote("");
      await load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to record payout");
    } finally {
      setPaying(false);
    }
  };

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

  if (!data) {
    return <p className="text-sm text-slate-500">Loading payout details…</p>;
  }

  const { bankAccount, payouts, availableBalance } = data;
  const hasBankAccount = Boolean(bankAccount?.accountNumber || bankAccount?.iban);

  return (
    <div className="space-y-6">
      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payout bank account</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Given by the physiotherapist on their application or earnings page. Keeps{" "}
              {data.physiotherapistPercent}% of each visit fee; paid every Sunday.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!hasBankAccount ? (
            <p className="text-sm text-amber-700">
              No bank account on file yet — the physiotherapist hasn&apos;t added one.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Account title" value={bankAccount?.accountTitle} />
              <Row label="Bank name" value={bankAccount?.bankName} />
              <Row label="Account number" value={bankAccount?.accountNumber} />
              <Row label="IBAN" value={bankAccount?.iban} />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Pay this physiotherapist</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Pays the full outstanding balance (their {data.physiotherapistPercent}% share) and
              uploads the payment receipt.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {paySuccess && (
            <p className="text-sm text-emerald-700">Payout recorded and receipt uploaded.</p>
          )}
          {availableBalance <= 0 ? (
            <p className="text-sm text-emerald-700">
              This physiotherapist is fully paid up. No balance due.
            </p>
          ) : !hasBankAccount ? (
            <p className="text-sm text-amber-700">
              Balance due {formatCurrency(availableBalance)} — waiting for the physiotherapist to
              add a bank account.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                Amount to pay:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(availableBalance)}
                </span>
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="physio-payout-method"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Payment method
                  </label>
                  <select
                    id="physio-payout-method"
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
                  <label
                    htmlFor="physio-payout-note"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Note (optional)
                  </label>
                  <input
                    id="physio-payout-note"
                    className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={paying}
                    maxLength={500}
                    placeholder="e.g. transfer reference"
                  />
                </div>
              </div>

              <label
                htmlFor="physio-payout-receipt"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-muted/30"
              >
                <Upload className="h-5 w-5 text-brand" />
                <span className="text-sm font-medium text-slate-700">
                  {file ? file.name : "Upload payment receipt (required)"}
                </span>
                <input
                  id="physio-payout-receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  disabled={paying}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {payError && <p className="text-sm text-red-600">{payError}</p>}

              <Button onClick={submitPayout} disabled={paying}>
                {paying ? "Recording payout…" : `Pay ${formatCurrency(availableBalance)}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payout history</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Total paid {formatCurrency(data.totalPaidOut)} of{" "}
              {formatCurrency(data.totalEarnings)} earned.
            </p>
          </div>
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
                      {p.method.replace(/_/g, " ")} · paid by {p.paidByName} ·{" "}
                      {new Date(p.paidAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  {p.receiptUrl && (
                    <a
                      href={p.receiptUrl}
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
    </div>
  );
}
