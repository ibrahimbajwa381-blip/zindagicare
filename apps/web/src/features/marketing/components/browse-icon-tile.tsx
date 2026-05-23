import Link from "next/link";
import { cn } from "@zindagi/shared";
import type { BrowseItem } from "../data/browse-catalog";

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
        "group flex min-w-[5.5rem] flex-col items-center gap-3 rounded-2xl px-2 py-3 text-center transition-all duration-200",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/40 focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br p-3 shadow-sm ring-1 transition-all duration-200",
          "group-hover:shadow-premium sm:h-20 sm:w-20 sm:p-3.5",
          item.ring,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-white/50"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.label}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="relative h-9 w-9 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10"
        />
      </span>
      <span className="max-w-[6.5rem] text-xs font-medium leading-snug text-slate-600 transition-colors group-hover:text-foreground sm:text-sm">
        {item.label}
      </span>
    </Link>
  );
}
