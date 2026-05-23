import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@zindagi/shared";
import type { BrowseItem } from "../data/browse-catalog";
import { BrowseIconTile } from "./browse-icon-tile";

type BrowseSectionRowProps = {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  items: BrowseItem[];
  queryParam: "specialty" | "condition";
  /** Wider tiles in a single scroll row (conditions) vs wrapped grid (specialties) */
  variant?: "grid" | "scroll";
  className?: string;
};

export function BrowseSectionRow({
  title,
  viewAllHref = siteConfig.links.doctors,
  viewAllLabel = "View all",
  items,
  queryParam,
  variant = "grid",
  className,
}: BrowseSectionRowProps) {
  return (
    <div className={cn(className)}>
      <div className="flex items-end justify-between gap-4">
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h3>
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand underline-offset-4 transition-colors hover:text-brand-dark hover:underline"
        >
          {viewAllLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {variant === "grid" ? (
        <div className="mt-8 grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-5 md:grid-cols-7 md:gap-x-3">
          {items.map((item) => (
            <BrowseIconTile
              key={item.slug}
              item={item}
              href={`${siteConfig.links.doctors}?${queryParam}=${item.slug}`}
            />
          ))}
        </div>
      ) : (
        <div className="browse-scroll -mx-4 mt-8 px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex gap-3 pb-2 sm:grid sm:grid-cols-4 sm:gap-6 sm:pb-0 md:grid-cols-7">
            {items.map((item) => (
              <BrowseIconTile
                key={item.slug}
                item={item}
                href={`${siteConfig.links.doctors}?${queryParam}=${item.slug}`}
                className="shrink-0 sm:min-w-0"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
