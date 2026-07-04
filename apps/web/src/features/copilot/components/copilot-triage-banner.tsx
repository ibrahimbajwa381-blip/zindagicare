"use client";

import { AlertTriangle, Phone } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { CopilotMessageMetadata } from "@zindagi/validators";

type TriageLevel = NonNullable<CopilotMessageMetadata["triageLevel"]>;

type CopilotTriageBannerProps = {
  level: TriageLevel;
  emergencyTitle: string;
  emergencyBody: string;
  urgentTitle: string;
  urgentBody: string;
  callEmergency: string;
};

export function CopilotTriageBanner({
  level,
  emergencyTitle,
  emergencyBody,
  urgentTitle,
  urgentBody,
  callEmergency,
}: CopilotTriageBannerProps) {
  if (level !== "emergency" && level !== "urgent") return null;

  const isEmergency = level === "emergency";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        isEmergency
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{isEmergency ? emergencyTitle : urgentTitle}</p>
          <p className="mt-1 text-sm">{isEmergency ? emergencyBody : urgentBody}</p>
          {isEmergency ? (
            <a
              href="tel:1122"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {callEmergency}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
