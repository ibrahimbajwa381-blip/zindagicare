"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bot, Mic, MicOff, Sparkles, X } from "lucide-react";
import { Roles, cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { useLocalStorageFlag } from "@/hooks/use-local-storage-flag";
import { useMounted } from "@/hooks/use-mounted";
import { useCopilotVoice } from "@/features/copilot/hooks/use-copilot-voice";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

const ASSISTANT_PATH = siteConfig.links.assistant;
const WAVE_DELAYS = ["0ms", "120ms", "240ms", "360ms", "480ms"] as const;
const BADGE_DISMISSED_KEY = "zindagicare.agent-float-badge-dismissed";

function buildAssistantUrl(message: string, isLoggedIn: boolean, hasPatientRole: boolean) {
  const assistantWithMessage = `${ASSISTANT_PATH}?message=${encodeURIComponent(message)}`;
  if (isLoggedIn && hasPatientRole) return assistantWithMessage;

  const authPath = isLoggedIn ? siteConfig.links.register : siteConfig.links.login;
  return `${authPath}?callbackUrl=${encodeURIComponent(assistantWithMessage)}`;
}

export function AgentFloatButton() {
  const mounted = useMounted();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const copy = t.agentFloat;
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const hasPatientRole = session?.user?.roles?.includes(Roles.PATIENT) ?? false;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [badgeDismissed, dismissBadge] = useLocalStorageFlag(BADGE_DISMISSED_KEY);

  const stopListeningRef = useRef<() => void>(() => {});
  const stopSpeakingRef = useRef<() => void>(() => {});

  const onTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stopListeningRef.current();
      stopSpeakingRef.current();
      setStatus(copy.heardYou);
      router.push(buildAssistantUrl(trimmed, isLoggedIn, hasPatientRole));
    },
    [copy.heardYou, hasPatientRole, isLoggedIn, router],
  );

  const { listening, speaking, startListening, stopListening, stopSpeaking } = useCopilotVoice({
    locale,
    onTranscript,
    onError: (message) => setStatus(message),
  });

  useEffect(() => {
    stopListeningRef.current = stopListening;
    stopSpeakingRef.current = stopSpeaking;
  }, [stopListening, stopSpeaking]);

  const hideOnPage =
    pathname === ASSISTANT_PATH || pathname.startsWith(`${ASSISTANT_PATH}/`);

  const beginListening = useCallback(() => {
    if (speaking) return;
    setStatus(copy.listening);
    void startListening();
  }, [copy.listening, speaking, startListening]);

  const handleClose = useCallback(() => {
    stopListening();
    stopSpeaking();
    setOpen(false);
    setStatus(null);
  }, [stopListening, stopSpeaking]);

  const handleMicClick = useCallback(() => {
    if (!open) {
      setOpen(true);
      setStatus(copy.tapToSpeak);
      beginListening();
      return;
    }

    if (listening) {
      stopListening();
      setStatus(copy.tapToSpeak);
      return;
    }

    beginListening();
  }, [beginListening, copy.tapToSpeak, listening, open, stopListening]);

  if (!mounted || hideOnPage) return null;

  const statusLabel = listening
    ? copy.listening
    : speaking
      ? copy.introducing
      : (status ?? copy.tapToSpeak);

  const active = listening || open;

  return (
    <div
      className={cn(
        "fixed z-40 flex flex-col items-end gap-3",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-[max(1rem,env(safe-area-inset-right))]",
      )}
    >
      {open ? (
        <div
          className="agent-float-gradient-border w-[min(19rem,calc(100vw-2rem))] rounded-2xl p-[1.5px] shadow-premium-lg"
          role="dialog"
          aria-label={copy.panelTitle}
        >
          <div className="agent-float-glass overflow-hidden rounded-[calc(1rem-1px)]">
            <div className="relative border-b border-white/60 bg-gradient-to-r from-brand/10 via-white/80 to-accent/10 px-4 py-3.5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(15_167_155/0.12),transparent_55%)]"
              />
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white shadow-md">
                    <Bot className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                    <Sparkles
                      className="absolute -right-1 -top-1 h-3.5 w-3.5 text-brand-lighter drop-shadow"
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{copy.panelTitle}</p>
                    <p className="text-[11px] text-slate-500">{copy.panelSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600"
                  aria-label={copy.close}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  {WAVE_DELAYS.map((delay) => (
                    <span
                      key={delay}
                      className={cn(
                        "w-1 rounded-full bg-brand/70",
                        listening ? "agent-float-wave h-4" : "h-1.5 opacity-40",
                      )}
                      style={{ animationDelay: delay }}
                      aria-hidden
                    />
                  ))}
                </span>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-600">{statusLabel}</p>
              </div>

              {listening ? (
                <p className="rounded-xl border border-red-200/80 bg-gradient-to-r from-red-50 to-rose-50 px-3 py-2 text-center text-[11px] font-medium text-red-700">
                  {copy.tapWhenDone}
                </p>
              ) : null}

              <Link
                href={ASSISTANT_PATH}
                className="block rounded-xl border border-brand/15 bg-white/60 px-3 py-2 text-center text-xs font-medium text-brand-dark transition-colors hover:bg-brand-muted/50"
              >
                {copy.openAssistant}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="group flex flex-col items-center gap-2.5">
        {!badgeDismissed ? (
          <div className="agent-float-gradient-border rounded-2xl p-[1px] shadow-premium">
            <div className="agent-float-glass rounded-[calc(1rem-1px)] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-accent text-white shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-start">
                  <p className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-foreground">
                    <span className="agent-float-shimmer text-gradient-premium">{copy.badgeTitle}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      {copy.badgeLive}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{copy.badgeHint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissBadge(true)}
                  className="-me-0.5 -mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600"
                  aria-label={copy.close}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "agent-float-orb pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-brand/40 via-accent/25 to-brand-light/30 blur-xl",
              active && "from-red-400/35 via-rose-300/20 to-red-400/25",
            )}
          />

          <span
            aria-hidden
            className={cn(
              "agent-float-ring pointer-events-none absolute -inset-1.5 rounded-full opacity-80",
              "bg-[conic-gradient(from_0deg,var(--primary-light),var(--accent-lighter),var(--primary),var(--accent),var(--primary-light))]",
              listening && "from-red-400 via-rose-300 to-red-500",
            )}
          />

          <button
            type="button"
            onClick={handleMicClick}
            title={copy.micLabel}
            aria-label={listening ? copy.stopListening : copy.micLabel}
            aria-expanded={open}
            className={cn(
              "relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full",
              "bg-gradient-to-br shadow-premium-lg ring-2 ring-white/90",
              "md:transition-transform md:duration-300 md:hover:scale-105 md:active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
              listening
                ? "from-red-500 to-rose-600 text-white"
                : "from-brand via-brand-dark to-accent text-white hover:shadow-[0_8px_32px_rgb(15_167_155/0.45)]",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-1 rounded-full bg-gradient-to-t from-white/10 to-white/25"
            />

            {listening ? (
              <>
                <span
                  className="absolute inset-0 animate-ping rounded-full bg-white/20"
                  aria-hidden
                />
                <MicOff className="relative h-7 w-7 drop-shadow-sm" aria-hidden />
              </>
            ) : (
              <Mic className="relative h-7 w-7 drop-shadow-sm" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
