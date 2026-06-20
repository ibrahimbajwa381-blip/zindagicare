import Link from "next/link";
import { cn } from "@zindagi/shared";
import type { BrowseItem } from "../data/browse-catalog";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type BrowseIconTileProps = {
  item: BrowseItem;
  href: string;
  className?: string;
  onNavigate?: () => void;
};

export function BrowseIconTile({
  item,
  href,
  className,
  onNavigate,
}: BrowseIconTileProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        surfaceCardInteractive,
        "group flex min-w-0 w-full flex-col items-center gap-2 p-2.5 text-center sm:gap-3 sm:p-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/40 focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br p-2 shadow-sm ring-1 ring-white/60 transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14 sm:p-2.5",
          item.ring,
        )}
      >
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-white/45" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.label}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="relative h-7 w-7 object-contain sm:h-8 sm:w-8"
        />
      </span>
      <span className="flex min-h-[2.75rem] w-full min-w-0 items-start justify-center px-0.5 text-center font-display text-[11px] font-semibold leading-[1.3] text-slate-700 [overflow-wrap:anywhere] transition-colors group-hover:text-foreground sm:min-h-[2.5rem] sm:text-sm">
        {item.label}
      </span>
    </Link>
  );
}
