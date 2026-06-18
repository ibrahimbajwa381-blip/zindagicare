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
        "group flex flex-col items-center gap-3 p-3 text-center sm:p-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/40 focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br p-2.5 shadow-sm ring-1 ring-white/60 transition-transform duration-300 group-hover:scale-105",
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
          className="relative h-8 w-8 object-contain"
        />
      </span>
      <span className="font-display text-xs font-semibold leading-snug text-slate-700 transition-colors group-hover:text-foreground sm:text-sm">
        {item.label}
      </span>
    </Link>
  );
}
