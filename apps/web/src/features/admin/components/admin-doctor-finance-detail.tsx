"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CheckCircle2, Landmark, ListChecks, Receipt, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { AdminDoctorFinanceDetail as FinanceDetail } from "@/server/services/admin-doctor-finance.service";

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

export function AdminDoctorFinanceDetail({ doctorProfileId }: { doctorProfileId: string }) {
  const [data, setData] = useState<FinanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [referralPendingId, setReferralPendingId] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [method, setMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();
  const [paySuccess, setPaySuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const res = await fetch(`/api/v1/admin/doctors/${doctorProfileId}/finance`);
    const json = await res.json();
    if (json.success) {
      setData(json.data as FinanceDetail);
    } else {
      setError(json?.error?.message ?? "Could not load finance details");
    }
    setLoading(false);
  }, [doctorProfileId]);

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
    formData.append("amount", String(data.balanceDue));
    formData.append("method", method);
    if (note.trim()) formData.append("note", note.trim());
    formData.append("receipt", file);

    const res = await fetch(`/api/v1/admin/doctors/${doctorProfileId}/finance/payouts`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    setPaying(false);
    if (!res.ok || !json.success) {
      setPayError(json?.error?.message ?? "Failed to record payout");
      return;
    }
    setPaySuccess(true);
    setFile(null);
    setNote("");
    await load();
  };

  const toggleReferral = async (appointmentId: string, patientName: string, currentlyReferred: boolean) => {
    const nextIsReferral = !currentlyReferred;
    const warning = nextIsReferral
      ? `Mark ${patientName} as referred by ${doctor.name}? This applies the referral commission bonus (+15%) to ALL of this patient's appointments with this doctor, not just this one.`
      : `Remove the referral link between ${patientName} and ${doctor.name}? This affects ALL of their appointments, not just this one.`;
    if (!window.confirm(warning)) return;

    setReferralPendingId(appointmentId);
    setReferralError(null);
    try {
      const res = await fetch(`/api/v1/admin/appointments/${appointmentId}/referral`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReferral: nextIsReferral }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to update referral status");
      }
      await load();
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : "Failed to update referral status");
    } finally {
      setReferralPendingId(null);
    }
  };

  const deleteAppointment = async (appointmentId: string, patientName: string) => {
    if (
      !window.confirm(
        `Permanently delete this appointment (${patientName} ↔ ${doctor.name})? This removes it and its payment record from the database and cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(appointmentId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/admin/appointments/${appointmentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to delete appointment");
      }
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete appointment");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !data) {
    return <LoadingScreen message="Loading finance details…" />;
  }

  const { doctor, earnings, bankAccount, payouts, balanceDue, appointments } = data;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <AdminDoctorAvatar name={doctor.name} avatarUrl={doctor.avatarUrl} size="md" />
          <div>
            <CardTitle className="text-base">{doctor.name}</CardTitle>
            <p className="mt-0.5 text-sm text-slate-500">
              {doctor.specialties.join(", ") || "No listed specialties"}
              {doctor.email ? ` · ${doctor.email}` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Total earned" value={formatCurrency(earnings.totalEarnings)} />
            <Stat label="This month" value={formatCurrency(earnings.earningsThisMonth)} />
            <Stat
              label="Balance due"
              value={formatCurrency(balanceDue)}
              accent={balanceDue > 0}
            />
            <Stat label="Patients referred" value={String(doctor.referredPatientCount)} />
          </div>
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payout bank account</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Set by the doctor from their earnings page.</p>
          </div>
        </CardHeader>
        <CardContent>
          {!bankAccount || (!bankAccount.accountNumber && !bankAccount.iban) ? (
            <p className="text-sm text-amber-700">
              No bank account on file yet — the doctor hasn&apos;t added one.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Account title" value={bankAccount.accountTitle} />
              <Row label="Bank name" value={bankAccount.bankName} />
              <Row label="Account number" value={bankAccount.accountNumber} />
              <Row label="IBAN" value={bankAccount.iban} />
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
            <CardTitle className="text-base">Pay this doctor</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Pays the full outstanding balance and uploads the payment receipt.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {balanceDue <= 0 ? (
            <p className="text-sm text-emerald-700">This doctor is fully paid up. No balance due.</p>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                Amount to pay:{" "}
                <span className="font-semibold text-slate-900">{formatCurrency(balanceDue)}</span>
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Payment method</label>
                  <select
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
                  <label className="block text-sm font-medium text-slate-900">Note (optional)</label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={paying}
                    placeholder="e.g. transfer reference"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="payout-receipt"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-muted/30"
                >
                  <Upload className="h-5 w-5 text-brand" />
                  <span className="text-sm font-medium text-slate-700">
                    {file ? file.name : "Upload payment receipt (required)"}
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
              </div>

              {payError && <p className="text-sm text-red-600">{payError}</p>}
              {paySuccess && (
                <p className="text-sm text-emerald-700">Payout recorded and receipt uploaded.</p>
              )}

              <Button onClick={submitPayout} disabled={paying}>
                {paying ? "Recording payout…" : `Pay ${formatCurrency(balanceDue)}`}
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
                      {p.method.replace(/_/g, " ")} · paid by {p.paidByName} ·{" "}
                      {new Date(p.paidAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
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

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Appointments &amp; earning eligibility</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Last 100 appointments, with the exact reason each one did or didn&apos;t count
              toward earnings — including whether the patient or doctor actually joined the
              video consult.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-500">No appointments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              {referralError && <p className="mb-2 text-sm text-red-600">{referralError}</p>}
              {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 font-medium">Patient joined</th>
                    <th className="px-3 py-2 font-medium">Doctor joined</th>
                    <th className="px-3 py-2 font-medium">Earning</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                    <th className="px-3 py-2 font-medium">Referral</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 align-top">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {new Date(a.scheduledStart).toLocaleString("en-PK", {
                          timeZone: "Asia/Karachi",
                        })}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {a.patientName}
                        {a.isReferred && (
                          <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                            Referral
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-600">{a.status}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {a.amountPkr != null ? formatCurrency(a.amountPkr) : "—"}
                        {a.paymentStatus && (
                          <span className="ml-1 text-xs capitalize text-slate-400">
                            ({a.paymentStatus})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {a.patientJoinedAt ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {a.doctorJoinedAt ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-300" />
                        )}
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
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleReferral(a.id, a.patientName, a.isReferred)}
                          disabled={referralPendingId === a.id}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {referralPendingId === a.id
                            ? "Saving…"
                            : a.isReferred
                              ? "Remove referral"
                              : "Mark as referral"}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => deleteAppointment(a.id, a.patientName)}
                          disabled={deletingId === a.id}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === a.id ? "Deleting…" : "Delete"}
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
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/50"}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-amber-900" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
