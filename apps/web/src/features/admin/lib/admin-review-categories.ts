import {
  Activity,
  HeartPulse,
  MessageSquareQuote,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { HomeVisitProviderKinds, type HomeVisitProviderKind } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import type { AdminNavCounts } from "@/features/admin/types/admin-nav";

export const ADMIN_REVIEWS_ROOT = "/admin/reviews";

const PLATFORM_REVIEWS_SLUG = "zindagicare";

/** Platform testimonials (formerly /admin/testimonials). */
export const ADMIN_PLATFORM_REVIEWS_HREF = `${ADMIN_REVIEWS_ROOT}/${PLATFORM_REVIEWS_SLUG}`;

/** Where a set of reviews is stored, which decides the API and moderation UI used. */
export type AdminReviewSource =
  /** Online / Sunday / urgent consultation reviews of doctors. */
  | { kind: "consult" }
  /** Reviews patients leave after a completed home visit. */
  | { kind: "home-visit"; provider: HomeVisitProviderKind }
  /** Reviews of the platform itself (testimonials shown on the website). */
  | { kind: "platform" };

export type AdminReviewTab = {
  /** `?source=` value; the first tab is the default and has no query param. */
  id: string;
  label: string;
  source: AdminReviewSource;
};

/** Everything the admin UI needs to render one review category. */
export type AdminReviewCategory = {
  /** URL segment under /admin/reviews. */
  slug: string;
  href: string;
  navLabel: string;
  navDescription: string;
  icon: LucideIcon;
  pageTitle: string;
  pageDescription: string;
  /** Sidebar badge: reviews still waiting for moderation. */
  navCountKey?: keyof AdminNavCounts;
  tabs: AdminReviewTab[];
};

function category(
  slug: string,
  config: Omit<AdminReviewCategory, "slug" | "href">,
): AdminReviewCategory {
  return { slug, href: `${ADMIN_REVIEWS_ROOT}/${slug}`, ...config };
}

/** Review categories in sidebar / hub display order. */
export const ADMIN_REVIEW_CATEGORY_LIST: AdminReviewCategory[] = [
  category("doctors", {
    navLabel: "Doctor reviews",
    navDescription: "Consultations and doctor home visits",
    icon: Stethoscope,
    pageTitle: "Doctor reviews",
    pageDescription:
      "Moderate patient ratings of doctors. Hidden or removed consultation reviews no longer affect public doctor profiles.",
    navCountKey: "reviewsDoctor",
    tabs: [
      { id: "consultations", label: "Consultations", source: { kind: "consult" } },
      {
        id: "home-visits",
        label: "Home visits",
        source: { kind: "home-visit", provider: HomeVisitProviderKinds.DOCTOR },
      },
    ],
  }),
  category("physiotherapists", {
    navLabel: "Physiotherapist reviews",
    navDescription: "Home physiotherapy sessions",
    icon: Activity,
    pageTitle: "Physiotherapist reviews",
    pageDescription:
      "Moderate patient ratings of physiotherapists. Hidden or removed reviews no longer appear on public physiotherapist profiles.",
    navCountKey: "reviewsPhysiotherapist",
    tabs: [
      {
        id: "home-visits",
        label: "Home visits",
        source: { kind: "home-visit", provider: HomeVisitProviderKinds.PHYSIOTHERAPIST },
      },
    ],
  }),
  category("nurses", {
    navLabel: "Nurse reviews",
    navDescription: "Home nursing visits",
    icon: HeartPulse,
    pageTitle: "Nurse reviews",
    pageDescription: "Moderate patient ratings of nurses after completed home visits.",
    navCountKey: "reviewsNurse",
    tabs: [
      {
        id: "home-visits",
        label: "Home visits",
        source: { kind: "home-visit", provider: HomeVisitProviderKinds.NURSE },
      },
    ],
  }),
  category(PLATFORM_REVIEWS_SLUG, {
    navLabel: `${siteConfig.name} reviews`,
    navDescription: "Testimonials about the platform",
    icon: MessageSquareQuote,
    pageTitle: `${siteConfig.name} reviews`,
    pageDescription:
      "Manage the experience stories shown on the public website. Hidden testimonials no longer appear on the homepage. New patient submissions go live automatically.",
    tabs: [{ id: "testimonials", label: "Testimonials", source: { kind: "platform" } }],
  }),
];

export function adminReviewCategoryBySlug(slug: string): AdminReviewCategory | undefined {
  return ADMIN_REVIEW_CATEGORY_LIST.find((item) => item.slug === slug);
}

/** The tab named by `?source=`, falling back to the category's first tab. */
export function adminReviewTab(category: AdminReviewCategory, tabId?: string): AdminReviewTab {
  return category.tabs.find((tab) => tab.id === tabId) ?? category.tabs[0];
}

export function adminReviewTabHref(category: AdminReviewCategory, tab: AdminReviewTab): string {
  return tab.id === category.tabs[0].id
    ? category.href
    : `${category.href}?source=${encodeURIComponent(tab.id)}`;
}

/** Base URL of the moderation API for a source (list, /moderate, /approve-all). */
export function adminReviewApiBase(source: Exclude<AdminReviewSource, { kind: "platform" }>): string {
  return source.kind === "consult"
    ? "/api/v1/admin/reviews"
    : `/api/v1/admin/home-visit-reviews/${source.provider}`;
}
