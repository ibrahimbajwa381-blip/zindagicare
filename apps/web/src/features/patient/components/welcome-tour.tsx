"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  Home,
  HeartPulse,
  Languages,
  MessageSquare,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";
import { surfaceCard } from "@/lib/ui/surfaces";

const STORAGE_PREFIX = "zc:welcome-tour:v1:";

/** No external mutations to subscribe to within the session. */
function subscribeNoop() {
  return () => {};
}

/** Icon + colour accent for each step, paired by index with the dictionary copy. */
type StepIconComponent = React.ComponentType<{ className?: string }>;

const STEP_VISUALS: { icon: StepIconComponent; iconClass: string; bandClass: string }[] = [
  { icon: Sparkles, iconClass: "bg-brand/10 text-brand", bandClass: "from-brand/15 to-brand-light/5" },
  { icon: Video, iconClass: "bg-sky-100 text-sky-600", bandClass: "from-sky-100/70 to-sky-50/20" },
  { icon: CalendarCheck, iconClass: "bg-emerald-100 text-emerald-600", bandClass: "from-emerald-100/70 to-emerald-50/20" },
  { icon: Home, iconClass: "bg-violet-100 text-violet-600", bandClass: "from-violet-100/70 to-violet-50/20" },
  { icon: MessageSquare, iconClass: "bg-amber-100 text-amber-600", bandClass: "from-amber-100/70 to-amber-50/20" },
  { icon: ClipboardList, iconClass: "bg-teal-100 text-teal-600", bandClass: "from-teal-100/70 to-teal-50/20" },
  { icon: HeartPulse, iconClass: "bg-rose-100 text-rose-600", bandClass: "from-rose-100/70 to-rose-50/20" },
  { icon: Languages, iconClass: "bg-indigo-100 text-indigo-600", bandClass: "from-indigo-100/70 to-indigo-50/20" },
];

type WelcomeTourProps = {
  /** Per-user key so the tour only auto-shows once for each first-time user. */
  userId: string;
};

export function WelcomeTour({ userId }: WelcomeTourProps) {
  const t = useTranslations();
  const { locale } = useLocale();
  const tour = t.welcomeTour;
  const isRtl = locale === "ur";

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const steps = tour.steps;
  const total = steps.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  // Read "already seen" from storage without setState-in-effect; the server
  // snapshot is `true` so the tour never flashes during SSR/hydration.
  const hasSeen = useSyncExternalStore(
    subscribeNoop,
    () => {
      try {
        return window.localStorage.getItem(storageKey) != null;
      } catch {
        return true;
      }
    },
    () => true,
  );

  const open = !hasSeen && !dismissed;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Ignore storage failures; worst case the tour shows again.
    }
    setDismissed(true);
  }, [storageKey]);

  const goNext = useCallback(() => {
    setStep((current) => {
      if (current >= total - 1) {
        markSeen();
        return current;
      }
      return current + 1;
    });
  }, [markSeen, total]);

  const goBack = useCallback(() => {
    setStep((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        if (isRtl) goBack();
        else goNext();
      } else if (event.key === "ArrowLeft") {
        if (isRtl) goNext();
        else goBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isRtl, goNext, goBack]);

  const visual = STEP_VISUALS[step] ?? STEP_VISUALS[0];
  const StepIcon = visual.icon;
  const stepLabel = useMemo(
    () => formatMessage(tour.stepLabel, { current: step + 1, total }),
    [tour.stepLabel, step, total],
  );

  if (total === 0) return null;

  return (
    <dialog
      ref={dialogRef}
      className="welcome-tour-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-900/55 backdrop:backdrop-blur-sm"
      onClose={markSeen}
      onClick={(e) => {
        if (e.target === dialogRef.current) markSeen();
      }}
    >
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-t-3xl shadow-premium-lg sm:max-w-lg sm:rounded-3xl",
            surfaceCard,
          )}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          {/* Accent header band */}
          <div className={cn("relative bg-gradient-to-b px-6 pb-6 pt-7", visual.bandClass)}>
            <button
              type="button"
              onClick={markSeen}
              className="absolute top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 active:scale-95 ltr:right-4 rtl:left-4"
              aria-label={t.common.closeMenu}
            >
              <X className="h-5 w-5" />
            </button>

            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ring-1 ring-white/60",
                visual.iconClass,
              )}
            >
              <StepIcon className="h-8 w-8" aria-hidden />
            </span>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {stepLabel}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">
              {steps[step].title}
            </h2>
          </div>

          {/* Body copy */}
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {steps[step].body}
            </p>

            {/* Progress dots */}
            <div className="mt-6 flex items-center gap-1.5" aria-hidden>
              {steps.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === step ? "w-6 bg-brand" : "w-1.5 bg-slate-200",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={markSeen}
              className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
            >
              {tour.skip}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                  {tour.back}
                </Button>
              )}
              <Button
                size="sm"
                onClick={goNext}
                className="gap-1.5 bg-brand text-white hover:bg-brand-dark"
              >
                {isLast ? tour.finish : tour.next}
                {!isLast && <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
