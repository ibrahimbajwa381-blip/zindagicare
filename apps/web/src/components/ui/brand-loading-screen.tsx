"use client";

import { cn } from "@zindagi/shared";
import { SiteLogo } from "@/components/layout/site-logo";
import { useTranslations } from "@/i18n/locale-provider";

type BrandLoadingScreenProps = {
  /** Cover the full viewport and sit above header, footer, and floating widgets. */
  overlay?: boolean;
  message?: string;
  className?: string;
};

/**
 * Branded route transition loader — ZindagiCare logo, soft glow, and loading dots.
 * Used by route `loading.tsx` files and the global navigation loading provider.
 */
export function BrandLoadingScreen({
  overlay = false,
  message,
  className,
}: BrandLoadingScreenProps) {
  const t = useTranslations();
  const caption = message ?? t.common.loadingPage;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-8 px-6 text-center",
        overlay
          ? "fixed inset-0 z-[200] bg-gradient-to-br from-brand-muted via-white to-accent-muted"
          : "min-h-[60vh] w-full py-20",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="brand-loading-glow absolute left-1/2 top-1/2 size-[min(80vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute left-[20%] top-[25%] size-40 rounded-full bg-accent/5 blur-2xl" />
        <div className="absolute bottom-[20%] right-[15%] size-32 rounded-full bg-brand/5 blur-2xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <SiteLogo
          href={null}
          size="xl"
          priority
          className="brand-loading-logo"
        />

        <div className="flex items-center gap-2" aria-hidden>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="brand-loading-dot size-2 rounded-full bg-brand"
              style={{ animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </div>

        <p className="max-w-xs text-sm font-medium text-slate-500">{caption}</p>
      </div>
    </div>
  );
}
