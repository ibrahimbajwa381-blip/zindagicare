"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@zindagi/shared";

type Props = {
  doctorName: string;
  shareLabel: string;
  copiedLabel: string;
  className?: string;
};

export function ShareProfileButton({ doctorName, shareLabel, copiedLabel, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: doctorName, url });
      } catch {
        // user cancelled share sheet — no action needed
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark",
        className,
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? copiedLabel : shareLabel}
    </button>
  );
}
