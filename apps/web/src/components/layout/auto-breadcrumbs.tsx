"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { pageContainer } from "@/lib/ui/surfaces";
import {
  buildBreadcrumbsFromPathname,
  resolveBreadcrumbLabel,
  shouldShowBreadcrumbs,
} from "@/lib/nav/breadcrumbs";
import { useTranslations } from "@/i18n/locale-provider";

type AutoBreadcrumbsProps = {
  /** Marketing pages use a full-width bar; workspace pages sit above page content. */
  variant?: "marketing" | "workspace" | "inline";
  className?: string;
};

export function AutoBreadcrumbs({
  variant = "marketing",
  className,
}: AutoBreadcrumbsProps) {
  const pathname = usePathname() ?? "/";
  const dictionary = useTranslations();

  const items = useMemo(() => {
    if (!shouldShowBreadcrumbs(pathname)) return [];

    return buildBreadcrumbsFromPathname(pathname).map((item) => ({
      path: item.path,
      name: item.name,
      label: resolveBreadcrumbLabel(
        item,
        dictionary as unknown as Record<string, unknown>,
      ),
    }));
  }, [dictionary, pathname]);

  if (items.length <= 1) return null;

  if (variant === "workspace") {
    return <Breadcrumbs items={items} className={cn("mb-6", className)} />;
  }

  if (variant === "inline") {
    return <Breadcrumbs items={items} className={cn("mb-6", className)} />;
  }

  return (
    <div
      className={cn(
        "border-b border-slate-200/80 bg-white/90",
        className,
      )}
    >
      <div className={cn(pageContainer, "py-3")}>
        <Breadcrumbs items={items} />
      </div>
    </div>
  );
}
