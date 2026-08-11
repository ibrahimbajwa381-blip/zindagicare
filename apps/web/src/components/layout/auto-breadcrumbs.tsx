"use client";

type AutoBreadcrumbsProps = {
  /** Marketing pages use a full-width bar; workspace pages sit above page content. */
  variant?: "marketing" | "workspace" | "inline";
  className?: string;
};

/** Visible breadcrumbs are disabled site-wide. JSON-LD breadcrumbs remain for SEO. */
export function AutoBreadcrumbs(_props: AutoBreadcrumbsProps) {
  return null;
}
