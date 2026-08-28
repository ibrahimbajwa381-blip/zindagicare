"use client";

import { useState } from "react";
import { Check, Copy, Gift, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DoctorReferralCard({
  initialUrl,
  referredPatientCount,
  lifetimeBonusEarnings,
}: {
  initialUrl: string;
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string>();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — please copy the link manually.");
    }
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "Generate a new link? Your old referral link will stop working for new sign-ups.",
      )
    ) {
      return;
    }
    setRegenerating(true);
    setError(undefined);
    const res = await fetch("/api/v1/doctor/referral", { method: "POST" });
    const json = await res.json();
    setRegenerating(false);
    if (!res.ok || !json.success) {
      setError(json?.error?.message ?? "Could not generate a new link");
      return;
    }
    setUrl(json.data.referral.url);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/[0.06] via-white to-white shadow-sm">
      <div className="border-b border-brand/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-white text-brand">
            <Gift className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Invite your patients — keep more of every visit
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Patients who sign up through your personal link are yours. On every appointment
              with them, you keep an extra 15 percentage points — up to 85%+ of the consult
              fee, for as long as they&rsquo;re your patient.
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

        <div>
          <label className="block text-sm font-medium text-slate-900">
            Your personal referral link
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={url}
              className="w-full flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <Button type="button" onClick={copy} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy link
                  </>
                )}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Generating…" : "Generate a new link"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Patients referred</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{referredPatientCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Total earned from referral visits</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              PKR {lifetimeBonusEarnings.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
