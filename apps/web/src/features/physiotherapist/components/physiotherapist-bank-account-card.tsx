"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type BankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

type Props = {
  initial: BankAccount | null;
};

export function PhysiotherapistBankAccountCard({ initial }: Props) {
  const [account, setAccount] = useState<BankAccount>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const update = (key: keyof BankAccount, value: string) => {
    setSaved(false);
    setAccount((a) => ({ ...a, [key]: value }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/physiotherapist/bank-account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountTitle: account.accountTitle?.trim() ?? "",
          bankName: account.bankName?.trim() ?? "",
          accountNumber: account.accountNumber?.trim() ?? "",
          iban: account.iban?.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not save bank account");
      }
      setAccount(json.data.bankAccount ?? {});
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bank account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Landmark className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Payout bank account</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ZindagiCare sends your earnings to this account every Sunday.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="payoutAccountTitle">Account title</Label>
            <Input
              id="payoutAccountTitle"
              value={account.accountTitle ?? ""}
              onChange={(e) => update("accountTitle", e.target.value)}
              placeholder="Name on the account"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="payoutBankName">Bank / wallet name</Label>
            <Input
              id="payoutBankName"
              value={account.bankName ?? ""}
              onChange={(e) => update("bankName", e.target.value)}
              placeholder="e.g. Meezan Bank, JazzCash"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="payoutAccountNumber">Account number</Label>
            <Input
              id="payoutAccountNumber"
              value={account.accountNumber ?? ""}
              onChange={(e) => update("accountNumber", e.target.value)}
              inputMode="numeric"
              required
              minLength={4}
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="payoutIban">IBAN (optional)</Label>
            <Input
              id="payoutIban"
              value={account.iban ?? ""}
              onChange={(e) => update("iban", e.target.value)}
              maxLength={40}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Bank account saved.</p>}

        <Button type="submit" disabled={saving} loading={saving}>
          {saving ? "Saving…" : "Save bank account"}
        </Button>
      </form>
    </section>
  );
}
