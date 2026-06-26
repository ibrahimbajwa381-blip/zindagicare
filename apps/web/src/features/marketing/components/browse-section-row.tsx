import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@zindagi/shared";
import type { BrowseItem } from "../data/browse-catalog";
import { conditionDoctorPath } from "@/lib/seo/conditions";
import { specialtyDoctorPath } from "@/lib/seo/specialties";
import { BrowseIconTile } from "./browse-icon-tile";

const desktopColumnClasses: Record<number, string> = {
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
  8: "lg:grid-cols-8",
};

type BrowseSectionRowProps = {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  onViewAllClick?: () => void;
  items: BrowseItem[];
  queryParam: "specialty" | "condition";
  /** Hide items beyond this count below the `sm` breakpoint. */
  mobileLimit?: number;
  className?: string;
};

export function BrowseSectionRow({
  title,
  viewAllHref = siteConfig.links.doctors,
  viewAllLabel = "View all",
  onViewAllClick,
  items,
  queryParam,
  mobileLimit,
  className,
}: BrowseSectionRowProps) {
  const desktopCols =
    desktopColumnClasses[items.length] ?? "lg:grid-cols-4";

  const viewAllClass =
    "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-brand/15 bg-white/70 px-3 py-1.5 text-sm font-medium text-brand shadow-sm transition-colors hover:border-brand/30 hover:bg-white hover:text-brand-dark active:bg-brand-muted/40";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/70 bg-white/45 p-4 shadow-premium backdrop-blur-md sm:rounded-3xl sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 sm:items-end">
        <h3 className="min-w-0 font-display text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">
          {title}
        </h3>
        {onViewAllClick ? (
          <button type="button" onClick={onViewAllClick} className={viewAllClass}>
            {viewAllLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link href={viewAllHref} className={viewAllClass}>
            {viewAllLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div
        className={cn(
          "mt-5 grid grid-cols-3 gap-2.5 sm:mt-6 sm:grid-cols-4 sm:gap-3 md:gap-4",
          desktopCols,
        )}
      >
        {items.map((item, index) => (
          <BrowseIconTile
            key={item.slug}
            item={item}
            href={
              queryParam === "specialty"
                ? specialtyDoctorPath(item.slug)
                : conditionDoctorPath(item.slug)
            }
            className={
              mobileLimit != null && index >= mobileLimit ? "hidden sm:flex" : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
