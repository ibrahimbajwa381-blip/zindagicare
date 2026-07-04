"use client";

import { ShieldAlert } from "lucide-react";

type CopilotDisclaimerProps = {
  text: string;
};

export function CopilotDisclaimer({ text }: CopilotDisclaimerProps) {
  return (
    <div className="shrink-0 border-t border-slate-200/60 bg-slate-50/80 px-4 py-2 pb-safe">
      <p className="mx-auto flex max-w-3xl items-start justify-center gap-1.5 text-center text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        <span>{text}</span>
      </p>
    </div>
  );
}
