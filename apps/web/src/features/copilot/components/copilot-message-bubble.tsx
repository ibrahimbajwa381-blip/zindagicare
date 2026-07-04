"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { CopilotMessageDto } from "@/features/copilot/types";
import { detectMessageLanguage } from "@/lib/copilot/detect-message-language";
import { sanitizeCopilotDisplayText } from "@/lib/copilot/response-text";
import { CopilotBookedCard } from "./copilot-booked-card";
import { CopilotBookingCard, CopilotUrgentCard } from "./copilot-booking-card";
import { CopilotDoctorReferralList } from "./copilot-doctor-referral-list";
import { CopilotAuxiliaryCards } from "./copilot-auxiliary-cards";
import { CopilotTriageBanner } from "./copilot-triage-banner";

type CopilotMessageBubbleProps = {
  message: CopilotMessageDto;
  isStreaming?: boolean;
  streamingContent?: string;
  labels: {
    bookConsultation: string;
    consultationFee: string;
    pmdcVerified: string;
    urgentTitle: string;
    urgentDescription: string;
    urgentCta: string;
    doctorReferralTitle: string;
    slotsAvailable: string;
    bookedConfirmedTitle: string;
    bookedPendingTitle: string;
    bookedPendingDescription: string;
    payNow: string;
    viewDashboard: string;
    viewProfile: string;
    emergencyTitle: string;
    emergencyBody: string;
    urgentBannerTitle: string;
    urgentBannerBody: string;
    callEmergency: string;
  };
  onBook: (suggestion: NonNullable<CopilotMessageDto["metadata"]>["bookingSuggestion"]) => void;
  onPayBooking?: () => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isFallbackLoadingMessage(text: string): boolean {
  return (
    text.includes("Details are loading") ||
    text.includes("Details load ho rahi") ||
    text.includes("تفصیلات لوڈ ہو رہی")
  );
}

function AssistantAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm",
        streaming
          ? "bg-gradient-to-br from-brand to-brand-dark text-white"
          : "border border-brand-light/30 bg-white text-brand",
      )}
      aria-hidden
    >
      <Sparkles className="h-4 w-4" />
    </span>
  );
}

export function CopilotMessageBubble({
  message,
  isStreaming = false,
  streamingContent,
  labels,
  onBook,
  onPayBooking,
}: CopilotMessageBubbleProps) {
  const isUser = message.role === "user";
  const rawBody = isStreaming ? (streamingContent ?? "") : message.content;
  const replyLanguage = detectMessageLanguage(rawBody || message.content);
  const body = isUser
    ? rawBody
    : sanitizeCopilotDisplayText(rawBody, message.metadata, replyLanguage);
  const metadata = message.metadata;
  const isFallback = !isUser && !isStreaming && isFallbackLoadingMessage(body);
  const hasRichContent =
    !isStreaming &&
    Boolean(
      metadata?.doctorReferrals?.length ||
        metadata?.bookedAppointment ||
        metadata?.bookingSuggestion ||
        metadata?.urgentCareSuggestion ||
        metadata?.triageLevel === "emergency" ||
        metadata?.triageLevel === "urgent" ||
        (metadata && Object.keys(metadata).some((k) => k !== "triageLevel")),
    );

  if (isUser) {
    return (
      <div className="flex w-full justify-end px-1">
        <div className="relative max-w-[min(82%,28rem)] rounded-2xl rounded-br-md bg-gradient-to-br from-brand to-brand-dark px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-md shadow-brand/20">
          <p className="whitespace-pre-wrap break-words">{body}</p>
          <p className="mt-1.5 text-right text-[11px] text-white/65">{formatTime(message.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start gap-2.5 px-1">
      <AssistantAvatar streaming={isStreaming} />

      <div className="min-w-0 max-w-[min(88%,32rem)] flex-1 space-y-2">
        {body ? (
          <div
            className={cn(
              "rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
              isFallback
                ? "border border-amber-200/80 bg-amber-50/90 text-amber-950"
                : isStreaming
                  ? "border border-brand-light/25 bg-white text-slate-900"
                  : "border border-slate-200/70 bg-white text-slate-900",
            )}
          >
            {isFallback ? (
              <p className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <span className="whitespace-pre-wrap break-words">{body}</span>
              </p>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {body}
                {isStreaming ? (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
                ) : null}
              </p>
            )}
          </div>
        ) : null}

        {!isStreaming &&
        (metadata?.triageLevel === "emergency" || metadata?.triageLevel === "urgent") ? (
          <CopilotTriageBanner
            level={metadata.triageLevel}
            emergencyTitle={labels.emergencyTitle}
            emergencyBody={labels.emergencyBody}
            urgentTitle={labels.urgentBannerTitle}
            urgentBody={labels.urgentBannerBody}
            callEmergency={labels.callEmergency}
          />
        ) : null}

        {!isStreaming && metadata?.doctorReferrals?.length ? (
          <CopilotDoctorReferralList
            doctors={metadata.doctorReferrals}
            title={labels.doctorReferralTitle}
            feeLabel={labels.consultationFee}
            verifiedLabel={labels.pmdcVerified}
            slotsLabel={labels.slotsAvailable}
            viewProfileLabel={labels.viewProfile}
          />
        ) : null}

        {!isStreaming && metadata ? <CopilotAuxiliaryCards metadata={metadata} /> : null}

        {!isStreaming && metadata?.bookedAppointment ? (
          <CopilotBookedCard
            booking={metadata.bookedAppointment}
            confirmedTitle={labels.bookedConfirmedTitle}
            pendingTitle={labels.bookedPendingTitle}
            pendingDescription={labels.bookedPendingDescription}
            payNowLabel={labels.payNow}
            viewDashboardLabel={labels.viewDashboard}
            onPay={onPayBooking}
          />
        ) : null}

        {!isStreaming && metadata?.bookingSuggestion && !metadata?.bookedAppointment ? (
          <CopilotBookingCard
            suggestion={metadata.bookingSuggestion}
            bookLabel={labels.bookConsultation}
            feeLabel={labels.consultationFee}
            verifiedLabel={labels.pmdcVerified}
            onBook={() => onBook(metadata.bookingSuggestion)}
          />
        ) : null}

        {!isStreaming && metadata?.urgentCareSuggestion ? (
          <CopilotUrgentCard
            href={
              metadata.urgentCareSuggestion.prefillNotes
                ? `${metadata.urgentCareSuggestion.href}#request`
                : metadata.urgentCareSuggestion.href
            }
            title={labels.urgentTitle}
            description={labels.urgentDescription}
            ctaLabel={labels.urgentCta}
          />
        ) : null}

        {!isStreaming && !isFallback ? (
          <p
            className={cn(
              "text-[11px] text-slate-400",
              hasRichContent ? "ps-1" : "text-right",
            )}
          >
            {formatTime(message.createdAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
