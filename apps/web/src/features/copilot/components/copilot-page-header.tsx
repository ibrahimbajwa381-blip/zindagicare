"use client";

import { X } from "lucide-react";
import { useLocalStorageFlag } from "@/hooks/use-local-storage-flag";
import { useMounted } from "@/hooks/use-mounted";

const DISMISS_KEY = "copilot-page-intro-dismissed";

type CopilotPageHeaderProps = {
  navLabel: string;
  title: string;
  description: string;
  dismissLabel: string;
};

export function CopilotPageHeader({
  navLabel,
  title,
  description,
  dismissLabel,
}: CopilotPageHeaderProps) {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useLocalStorageFlag(DISMISS_KEY);

  if (!mounted || dismissed) return null;

  return (
    <div className="relative shrink-0 border-b border-brand-light/25 bg-white px-4 py-3 sm:px-8">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute end-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:end-6"
        aria-label={dismissLabel}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark/80">{navLabel}</p>
      <h1 className="pe-8 font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
  );
}
