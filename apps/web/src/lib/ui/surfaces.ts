import { cn } from "@zindagi/shared";

/** Frosted panels on gradient section backgrounds (solid on mobile — avoids GPU compositor glitches). */
export const surfaceCard =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm max-md:border-slate-200 md:border-white/60 md:bg-white/85 md:backdrop-blur-sm";

export const surfaceCardInteractive = cn(
  surfaceCard,
  "transition-all hover:border-brand-light/50 hover:bg-white hover:shadow-premium",
);

export const surfacePanel = cn(
  surfaceCard,
  "p-6 sm:p-8",
);

export const surfaceInset =
  "rounded-xl border border-slate-200/80 bg-white max-md:border-slate-200 md:border-white/50 md:bg-white/70 md:backdrop-blur-sm";

export const surfaceMuted =
  "rounded-xl border border-brand-light/30 bg-brand-muted max-md:border-brand-light/40 md:bg-brand-muted/70 md:backdrop-blur-sm";

export const pageContainer =
  "relative mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14";

export const appHeaderShell =
  "sticky top-0 z-50 border-b border-slate-200/90 bg-white supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] md:border-brand-light/25 md:bg-white/80 md:backdrop-blur-xl";

export const appHeaderInner = cn(
  pageContainer,
  "flex h-16 items-center gap-3 text-sm font-medium text-slate-600 sm:h-[4.75rem] sm:gap-6",
);

/** Offset fixed sidebars below the sticky app header. */
export const workspaceSidebarTop = "top-16 sm:top-[4.75rem]";

export function surfaceCardClass(className?: string) {
  return cn(surfaceCardInteractive, className);
}
