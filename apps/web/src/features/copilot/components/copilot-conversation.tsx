"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingSuggestionPayload } from "@zindagi/validators";
import type { CheckoutResult } from "@/features/consult/types";
import { ConsultReviewPaymentModal } from "@/features/consult/components/consult-review-payment-modal";
import { JazzCashRedirectForm } from "@/features/consult/components/jazzcash-redirect-form";
import { usePaymentProviders } from "@/features/consult/hooks/use-payment-providers";
import type { PaymentProviderInput } from "@zindagi/validators";
import { useMounted } from "@/hooks/use-mounted";
import { useLocale } from "@/i18n/locale-provider";
import type { CopilotMessageDto } from "@/features/copilot/types";
import {
  detectMessageLanguage,
  toLegacyLocale,
} from "@/features/copilot/lib/detect-message-locale";
import { buildCopilotResponseText } from "@/lib/copilot/response-text";
import { useCopilotVoice } from "@/features/copilot/hooks/use-copilot-voice";
import { CopilotComposer } from "./copilot-composer";
import { CopilotDisclaimer } from "./copilot-disclaimer";
import { CopilotMessageBubble } from "./copilot-message-bubble";
import { useCopilotStream } from "@/features/copilot/hooks/use-copilot-stream";

type CopilotCopy = {
  messagePlaceholder: string;
  disclaimer: string;
  bookConsultation: string;
  consultationFee: string;
  pmdcVerified: string;
  urgentTitle: string;
  urgentDescription: string;
  urgentCta: string;
  emergencyTitle: string;
  emergencyBody: string;
  urgentBannerTitle: string;
  urgentBannerBody: string;
  callEmergency: string;
  thinking: string;
  micLabel: string;
  stopMicLabel: string;
  doctorReferralTitle: string;
  slotsAvailable: string;
  bookedConfirmedTitle: string;
  bookedPendingTitle: string;
  bookedPendingDescription: string;
  payNow: string;
  viewDashboard: string;
  viewProfile: string;
};

type CopilotConversationProps = {
  sessionId: string;
  initialMessages: CopilotMessageDto[];
  pendingMessage?: string;
  copy: CopilotCopy;
};

type SendOptions = {
  inputMode?: "voice" | "text";
  messageLanguage?: ReturnType<typeof detectMessageLanguage>;
};

const bubbleLabels = (copy: CopilotCopy) => ({
  bookConsultation: copy.bookConsultation,
  consultationFee: copy.consultationFee,
  pmdcVerified: copy.pmdcVerified,
  urgentTitle: copy.urgentTitle,
  urgentDescription: copy.urgentDescription,
  urgentCta: copy.urgentCta,
  doctorReferralTitle: copy.doctorReferralTitle,
  slotsAvailable: copy.slotsAvailable,
  bookedConfirmedTitle: copy.bookedConfirmedTitle,
  bookedPendingTitle: copy.bookedPendingTitle,
  bookedPendingDescription: copy.bookedPendingDescription,
  payNow: copy.payNow,
  viewDashboard: copy.viewDashboard,
  viewProfile: copy.viewProfile,
  emergencyTitle: copy.emergencyTitle,
  emergencyBody: copy.emergencyBody,
  urgentBannerTitle: copy.urgentBannerTitle,
  urgentBannerBody: copy.urgentBannerBody,
  callEmergency: copy.callEmergency,
});

export function CopilotConversation({
  sessionId,
  initialMessages,
  pendingMessage,
  copy,
}: CopilotConversationProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const mounted = useMounted();
  const { sendMessage } = useCopilotStream();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<CopilotMessageDto[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingMetadata, setPendingMetadata] = useState<CopilotMessageDto["metadata"]>();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSuggestion, setBookingSuggestion] = useState<BookingSuggestionPayload | null>(
    null,
  );
  const [patientNotes, setPatientNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const { defaultProvider } = usePaymentProviders();
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInput>(defaultProvider);
  const [gatewayRedirect, setGatewayRedirect] = useState<CheckoutResult["gatewayRedirect"] | null>(
    null,
  );

  const handleSendRef = useRef<(content: string, options?: SendOptions) => Promise<void>>(
    async () => {},
  );

  const { listening, speaking, startListening, speakText } = useCopilotVoice({
    locale,
    onTranscript: (text) => {
      void handleSendRef.current(text, {
        inputMode: "voice",
        messageLanguage: detectMessageLanguage(text),
      });
    },
  });

  useEffect(() => {
    setPaymentProvider(defaultProvider);
  }, [defaultProvider]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  const runCheckout = useCallback(
    async (suggestion: BookingSuggestionPayload, notes = "") => {
      setBookingSuggestion(suggestion);
      setCheckoutLoading(true);
      setCheckoutError(null);
      setGatewayRedirect(null);

      try {
        const res = await fetch("/api/v1/consult/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorId: suggestion.doctorId,
            slotId: suggestion.slotId,
            patientNotes: notes.trim() || undefined,
            locale,
            paymentProvider,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message ?? "Could not start checkout");
        }

        const checkout = json.data as CheckoutResult;

        const payUrl =
          checkout.manualTransfer?.payUrl ?? checkout.testPayment?.completeUrl;
        if (payUrl) {
          window.location.href = payUrl;
          return;
        }

        const redirect = checkout.gatewayRedirect ?? checkout.jazzcash;
        if (redirect) {
          setGatewayRedirect(redirect);
        } else {
          throw new Error("Payment unavailable");
        }
      } catch (e) {
        setCheckoutError(e instanceof Error ? e.message : "Checkout failed");
        setBookingOpen(true);
      } finally {
        setCheckoutLoading(false);
      }
    },
    [locale, paymentProvider],
  );

  const openBooking = useCallback((suggestion: BookingSuggestionPayload | undefined) => {
    if (!suggestion) return;
    setBookingSuggestion(suggestion);
    setPatientNotes("");
    setCheckoutError(null);
    setBookingOpen(true);
  }, []);

  const startCheckout = useCallback(async () => {
    if (!bookingSuggestion) return;
    await runCheckout(bookingSuggestion, patientNotes);
  }, [bookingSuggestion, patientNotes, runCheckout]);

  const handleSend = useCallback(
    async (content: string, options?: SendOptions) => {
      const inputMode = options?.inputMode ?? "text";
      const messageLanguage = options?.messageLanguage ?? detectMessageLanguage(content);
      const messageLocale = toLegacyLocale(messageLanguage);

      const tempUser: CopilotMessageDto = {
        id: `pending-user-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUser]);
      setStreaming(true);
      setStreamingText("");
      setPendingMetadata(undefined);

      const tempAssistantId = `pending-assistant-${Date.now()}`;

      try {
        await sendMessage(
          sessionId,
          content,
          messageLocale,
          {
            onToken: (text) => {
              setStreamingText((prev) => prev + text);
            },
            onMetadata: (metadata) => {
              setPendingMetadata(metadata);
            },
            onDone: (message) => {
              setMessages((prev) => [
                ...prev.filter((m) => !m.id.startsWith("pending-")),
                { ...tempUser, id: tempUser.id.replace("pending-", "local-") },
                message,
              ]);
              setStreaming(false);
              setStreamingText("");
              setPendingMetadata(undefined);

              if (inputMode === "voice") {
                const speechText = buildCopilotResponseText(
                  message.content,
                  message.metadata,
                  messageLanguage,
                );
                void speakText(speechText, messageLocale);
              }

              if (
                message.metadata?.bookedAppointment?.status === "pending_payment" &&
                message.metadata.bookingSuggestion
              ) {
                void runCheckout(message.metadata.bookingSuggestion);
              }
            },
            onError: (message) => {
              setMessages((prev) => [
                ...prev.filter((m) => m.id !== tempAssistantId),
                {
                  id: tempAssistantId,
                  sessionId,
                  role: "assistant",
                  content: message,
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreaming(false);
              setStreamingText("");
            },
          },
          inputMode,
        );
      } catch {
        setStreaming(false);
      }
    },
    [openBooking, runCheckout, sendMessage, sessionId, speakText],
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const sentPendingRef = useRef(false);
  useEffect(() => {
    if (!pendingMessage || sentPendingRef.current || streaming) return;
    sentPendingRef.current = true;
    router.replace("/assistant", { scroll: false });
    void handleSend(pendingMessage, { inputMode: "voice" });
  }, [handleSend, pendingMessage, router, streaming]);

  const streamingMessage: CopilotMessageDto = {
    id: "streaming",
    sessionId,
    role: "assistant",
    content: streamingText,
    metadata: pendingMetadata,
    createdAt: new Date().toISOString(),
  };

  const labels = bubbleLabels(copy);

  return (
    <>
      {gatewayRedirect ? (
        <JazzCashRedirectForm
          actionUrl={gatewayRedirect.actionUrl}
          fields={gatewayRedirect.fields}
        />
      ) : null}

      {bookingSuggestion ? (
        <ConsultReviewPaymentModal
          open={bookingOpen}
          onOpenChange={(open) => {
            setBookingOpen(open);
            if (!open) setCheckoutError(null);
          }}
          doctorName={bookingSuggestion.doctorName}
          doctorSpecialty={bookingSuggestion.specialty}
          doctorAvatarUrl={bookingSuggestion.doctorAvatarUrl}
          consultationFee={bookingSuggestion.consultationFee}
          slotStartAt={bookingSuggestion.slotStartAt}
          slotFormatted={mounted}
          patientNotes={patientNotes}
          onPatientNotesChange={setPatientNotes}
          loading={checkoutLoading}
          error={checkoutError}
          paymentProvider={paymentProvider}
          onPaymentProviderChange={setPaymentProvider}
          onPay={startCheckout}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="chat-scroll copilot-chat-bg min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((message) => (
              <CopilotMessageBubble
                key={message.id}
                message={message}
                labels={labels}
                onBook={openBooking}
                onPayBooking={() => {
                  if (message.metadata?.bookingSuggestion) {
                    openBooking(message.metadata.bookingSuggestion);
                  }
                }}
              />
            ))}

            {streaming ? (
              <CopilotMessageBubble
                message={streamingMessage}
                isStreaming
                streamingContent={streamingText || copy.thinking}
                labels={labels}
                onBook={openBooking}
              />
            ) : null}
            </div>
          </div>

          <CopilotComposer
            onSend={(body) => handleSend(body, { inputMode: "text" })}
            placeholder={copy.messagePlaceholder}
            disabled={streaming || speaking}
            listening={listening}
            onMicClick={startListening}
            micLabel={copy.micLabel}
            stopMicLabel={copy.stopMicLabel}
          />
          <CopilotDisclaimer text={copy.disclaimer} />
        </div>
    </>
  );
}
