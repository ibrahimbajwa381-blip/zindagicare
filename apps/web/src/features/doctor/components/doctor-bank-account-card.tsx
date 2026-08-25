"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export function DoctorBankAccountCard() {
  const [account, setAccount] = useState<BankAccount>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/doctor/bank-account");
    const json = await res.json();
    if (json.success) {
      setAccount(json.data.bankAccount ?? {});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setSaved(false);
    const res = await fetch("/api/v1/doctor/bank-account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.success) {
      setError(json?.error?.message ?? "Could not save bank account");
      return;
    }
    setAccount(json.data.bankAccount ?? {});
    setSaved(true);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Landmark className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Payout bank account</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Where ZindagiCare sends your earnings. Keep this up to date.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Bank account saved.
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Account title"
              value={account.accountTitle ?? ""}
              onChange={(v) => setAccount((a) => ({ ...a, accountTitle: v }))}
              disabled={saving}
              placeholder="Full name on account"
            />
            <Field
              label="Bank name"
              value={account.bankName ?? ""}
              onChange={(v) => setAccount((a) => ({ ...a, bankName: v }))}
              disabled={saving}
              placeholder="e.g. HBL, UBL, Meezan"
            />
            <Field
              label="Account number"
              value={account.accountNumber ?? ""}
              onChange={(v) => setAccount((a) => ({ ...a, accountNumber: v }))}
              disabled={saving}
              placeholder="Bank account number"
            />
            <Field
              label="IBAN (optional)"
              value={account.iban ?? ""}
              onChange={(v) => setAccount((a) => ({ ...a, iban: v }))}
              disabled={saving}
              placeholder="PKxx xxxx xxxx xxxx xxxx xxxx"
            />
          </div>
        )}

        <div>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save bank account"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900">{label}</label>
      <Input
        className="mt-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
