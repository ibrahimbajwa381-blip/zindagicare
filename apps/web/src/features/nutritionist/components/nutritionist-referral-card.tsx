"use client";

import { useState } from "react";
import { Copy, Gift, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/features/nutritionist/types";

type Props = {
  code: string;
  url: string;
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
};

export function NutritionistReferralCard({
  code: initialCode,
  url: initialUrl,
  referredPatientCount,
  lifetimeBonusEarnings,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    const res = await fetch("/api/v1/nutritionist/referral", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setRegenerating(false);
    if (json?.success) {
      setCode(json.data.referral.code);
      setUrl(json.data.referral.url);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Gift className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Your patient invite link
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Patients who sign up through this link earn you a bigger revenue
              share on every consult they book with you — for life.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {url}
          </code>
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={regenerating}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {regenerating ? "Working…" : "New link"}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Referral code: <span className="font-medium text-slate-700">{code}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Referred patients
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {referredPatientCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total earned from referral visits
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatPkr(lifetimeBonusEarnings)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
