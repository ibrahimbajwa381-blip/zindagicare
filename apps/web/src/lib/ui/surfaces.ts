import { cn } from "@zindagi/shared";

/** Frosted panels on gradient section backgrounds */
export const surfaceCard =
  "rounded-2xl border border-white/60 bg-white/85 shadow-sm backdrop-blur-sm";

export const surfaceCardInteractive = cn(
  surfaceCard,
  "transition-all hover:border-brand-light/50 hover:bg-white hover:shadow-premium",
);

export const surfacePanel = cn(
  surfaceCard,
  "p-6 sm:p-8",
);

export const surfaceInset =
  "rounded-xl border border-white/50 bg-white/70 backdrop-blur-sm";

export const surfaceMuted =
  "rounded-xl border border-brand-light/30 bg-brand-muted/70 backdrop-blur-sm";

export const pageContainer =
  "relative mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14";

export const appHeaderShell =
  "sticky top-0 z-50 border-b border-brand-light/25 bg-white/80 backdrop-blur-xl supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]";

export const appHeaderInner = cn(
  pageContainer,
  "flex h-16 items-center gap-3 text-sm font-medium text-slate-600 sm:h-[4.75rem] sm:gap-6",
);

/** Offset fixed sidebars below the sticky app header. */
export const workspaceSidebarTop = "top-16 sm:top-[4.75rem]";

export function surfaceCardClass(className?: string) {
  return cn(surfaceCardInteractive, className);
}
