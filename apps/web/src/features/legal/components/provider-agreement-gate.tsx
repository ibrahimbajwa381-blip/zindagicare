"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Role = "doctor" | "nurse" | "physiotherapist" | "herbalist" | "nutritionist";

const AGREEMENT_ENDPOINT: Record<Role, string> = {
  doctor: "/api/v1/doctor/agreement",
  nurse: "/api/v1/nurse/agreement",
  physiotherapist: "/api/v1/physiotherapist/agreement",
  herbalist: "/api/v1/herbalist/agreement",
  nutritionist: "/api/v1/nutritionist/agreement",
};

type AgreementStatus = {
  accepted: boolean;
  currentVersion: string;
  version?: string;
};

/** Retroactive Provider Agreement prompt for accounts approved before the agreement existed. */
export function ProviderAgreementGate({ role }: { role: Role }) {
  const [status, setStatus] = useState<AgreementStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetch(AGREEMENT_ENDPOINT[role])
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setStatus(json.data as AgreementStatus);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (!status || status.accepted) return null;

  const accept = async () => {
    if (!checked) {
      setError("Please check the box to confirm you accept the agreement.");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    const res = await fetch(AGREEMENT_ENDPOINT[role], { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json?.error?.message ?? "Could not record your acceptance. Please try again.");
      return;
    }
    setStatus({ ...status, accepted: true });
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Action required: accept the ZindagiCare Provider Platform Agreement
          </p>
          <p className="mt-1 text-sm text-amber-800">
            We've introduced a formal Provider Platform Agreement covering off-platform bookings
            and payments. Please review and accept it to continue using your account without
            interruption.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/provider-agreement"
                target="_blank"
                className="font-medium underline underline-offset-2"
              >
                ZindagiCare Provider Platform Agreement
              </Link>
              . I will bring every patient I meet through ZindagiCare through the platform for
              booking and payment, and will not accept direct payment or take bookings
              off-platform.
            </span>
          </label>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <Button
            onClick={accept}
            disabled={submitting}
            className="mt-3 bg-amber-700 text-white hover:bg-amber-800"
          >
            {submitting ? "Submitting…" : "I agree"}
          </Button>
        </div>
      </div>
    </div>
  );
}
