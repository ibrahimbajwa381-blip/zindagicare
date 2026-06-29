import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { BreadcrumbItem } from "@/lib/seo/schema";

export type BreadcrumbDisplayItem = BreadcrumbItem & {
  label: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbDisplayItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isHome = item.path === "/";

          return (
            <li key={item.path} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-slate-300"
                  aria-hidden
                />
              )}
              {isLast ? (
                <span
                  className="truncate font-medium text-slate-700"
                  aria-current="page"
                >
                  {isHome ? (
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-1 truncate rounded-sm transition-colors hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                    isHome && "font-medium",
                  )}
                >
                  {isHome && <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
