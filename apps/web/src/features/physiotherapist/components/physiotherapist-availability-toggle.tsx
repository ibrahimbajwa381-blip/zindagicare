"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@zindagi/shared";

type PhysiotherapistAvailabilityToggleProps = {
  initialAvailable: boolean;
};

export function PhysiotherapistAvailabilityToggle({
  initialAvailable,
}: PhysiotherapistAvailabilityToggleProps) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    const next = !available;
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/v1/physiotherapist/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: next }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not update availability");
      }
      setAvailable(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update availability");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={available}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
          available
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-600",
        )}
      >
        <span
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            available ? "bg-emerald-500" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              available ? "translate-x-4.5" : "translate-x-0.5",
            )}
          />
        </span>
        {pending
          ? "Updating…"
          : available
            ? "Available for visits"
            : "Not accepting visits"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
