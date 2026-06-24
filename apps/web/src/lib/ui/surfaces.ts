import { cn } from "@zindagi/shared";

/** Solid panels — no backdrop-blur (causes Android scroll ghosting when stacked). */
export const surfaceCard =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

export const surfaceCardInteractive = cn(
  surfaceCard,
  "md:transition-[border-color,box-shadow,background-color] md:hover:border-brand-light/50 md:hover:bg-white md:hover:shadow-premium",
);

export const surfacePanel = cn(
  surfaceCard,
  "p-6 sm:p-8",
);

export const surfaceInset =
  "rounded-xl border border-slate-200 bg-white";

export const surfaceMuted =
  "rounded-xl border border-brand-light/40 bg-brand-muted";

export const pageContainer =
  "relative mx-auto w-full max-w-[100rem] px-4 sm:px-8 lg:px-14";

export const appHeaderShell =
  "sticky top-0 z-50 border-b border-slate-200/90 bg-white supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]";

export const appHeaderInner = cn(
  pageContainer,
  "flex h-16 items-center gap-3 text-sm font-medium text-slate-600 sm:h-[4.75rem] sm:gap-6",
);

/** Offset fixed sidebars below the sticky app header. */
export const workspaceSidebarTop = "top-16 sm:top-[4.75rem]";

export function surfaceCardClass(className?: string) {
  return cn(surfaceCardInteractive, className);
}
