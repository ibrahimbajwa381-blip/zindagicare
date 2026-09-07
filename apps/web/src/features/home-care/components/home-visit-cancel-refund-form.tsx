"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, FieldError } from "@/components/ui/input";
import { surfaceCard } from "@/lib/ui/surfaces";
import { cn } from "@zindagi/shared";

type Method = "bank" | "jazzcash" | "easypaisa";

const METHODS: { value: Method; label: string; icon: typeof Landmark; hint: string }[] = [
  { value: "jazzcash", label: "JazzCash", icon: Smartphone, hint: "Refund to your JazzCash mobile wallet" },
  { value: "easypaisa", label: "Easypaisa", icon: Banknote, hint: "Refund to your Easypaisa mobile wallet" },
  { value: "bank", label: "Bank transfer", icon: Landmark, hint: "Refund to your bank account" },
];

export function HomeVisitCancelRefundForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<Method>("jazzcash");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <Card className={cn(surfaceCard, "text-center")}>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-slate-900">Visit cancelled</h2>
          <p className="max-w-sm text-sm text-slate-600">
            Your home visit has been cancelled. Our team will review your refund request and send
            the money manually to the account you provided within 3–5 business days.
          </p>
          <Button className="mt-2" onClick={() => router.push("/home-care/visits")}>
            Back to home visits
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canSubmit =
    reason.trim().length >= 3 &&
    accountTitle.trim().length >= 2 &&
    accountNumber.trim().length >= 5 &&
    (method !== "bank" || bankName.trim().length >= 2);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "cancelled",
        cancellationReason: reason.trim(),
        refundMethod: method,
        refundAccountTitle: accountTitle.trim(),
        refundAccountNumber: accountNumber.trim(),
        ...(method === "bank" ? { refundBankName: bankName.trim() } : {}),
      }),
    });
    const json = await res.json();

    if (json.success) {
      setSuccess(true);
    } else {
      setError(json.error?.message ?? "Couldn't submit your request. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <Card className={surfaceCard}>
      <CardContent className="space-y-6 py-6">
        <p className="text-sm text-slate-600">
          This visit has already been paid for. Cancelling it will mark the visit cancelled right
          away and send a refund request to our team.
        </p>

        <div>
          <Label htmlFor="visit-refund-reason">Why are you cancelling?</Label>
          <textarea
            id="visit-refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. I no longer need this visit…"
            maxLength={500}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-brand/20 transition focus:border-brand-light focus:ring-2"
          />
        </div>

        <div>
          <Label>How should we send your refund?</Label>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {METHODS.map(({ value, label, icon: Icon, hint }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                  method === value
                    ? "border-brand-light bg-brand-muted/60 ring-1 ring-brand-light/60"
                    : "border-slate-200 bg-white hover:border-brand-light/50",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", method === value ? "text-brand-dark" : "text-slate-400")}
                  aria-hidden
                />
                <span className="text-sm font-semibold text-slate-900">{label}</span>
                <span className="text-xs leading-snug text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="visit-refund-account-title">Account holder name</Label>
            <Input
              id="visit-refund-account-title"
              value={accountTitle}
              onChange={(e) => setAccountTitle(e.target.value)}
              placeholder="As it appears on the account"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="visit-refund-account-number">
              {method === "bank" ? "Account number / IBAN" : "Mobile number"}
            </Label>
            <Input
              id="visit-refund-account-number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={method === "bank" ? "PKxx BANK 0000 1234 5678" : "03xx xxxxxxx"}
              maxLength={50}
            />
          </div>
          {method === "bank" ? (
            <div className="sm:col-span-2">
              <Label htmlFor="visit-refund-bank-name">Bank name</Label>
              <Input
                id="visit-refund-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HBL, Meezan Bank"
                maxLength={100}
              />
            </div>
          ) : null}
        </div>

        <FieldError message={error ?? undefined} />

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Button onClick={submit} disabled={!canSubmit || submitting} loading={submitting}>
            {submitting ? "Submitting…" : "Submit refund request"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/home-care/visits")} disabled={submitting}>
            Cancel
          </Button>
          <p className="w-full text-xs text-slate-400 sm:w-auto sm:ml-auto">
            We&apos;ll review your request and send the money manually — no gateway fees.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
