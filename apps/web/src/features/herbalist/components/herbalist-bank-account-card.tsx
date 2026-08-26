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

export function HerbalistBankAccountCard() {
  const [account, setAccount] = useState<BankAccount>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/herbalist/bank-account");
    const json = await res.json().catch(() => ({}));
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
    const res = await fetch("/api/v1/herbalist/bank-account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const json = await res.json().catch(() => ({}));
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
            <Landmark className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Payout bank account
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Where ZindagiCare sends your consultation earnings.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account title">
                <Input
                  value={account.accountTitle ?? ""}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, accountTitle: e.target.value }))
                  }
                />
              </Field>
              <Field label="Bank name">
                <Input
                  value={account.bankName ?? ""}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, bankName: e.target.value }))
                  }
                />
              </Field>
              <Field label="Account number">
                <Input
                  value={account.accountNumber ?? ""}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, accountNumber: e.target.value }))
                  }
                />
              </Field>
              <Field label="IBAN (optional)">
                <Input
                  value={account.iban ?? ""}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, iban: e.target.value }))
                  }
                />
              </Field>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && (
              <p className="text-sm text-emerald-700">Bank account saved.</p>
            )}

            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save bank account"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
