/** Visibility filters on admin review moderation lists. */
export const ADMIN_REVIEW_VISIBILITIES = ["pending", "all", "visible", "hidden"] as const;

export type AdminReviewVisibility = (typeof ADMIN_REVIEW_VISIBILITIES)[number];

export type AdminReviewModerationAction = "approve" | "hide" | "show" | "delete";

export function parseAdminReviewVisibility(value: string | null | undefined): AdminReviewVisibility {
  return (ADMIN_REVIEW_VISIBILITIES as readonly string[]).includes(value ?? "")
    ? (value as AdminReviewVisibility)
    : "all";
}

/** One row in any admin review moderation list (consult or home-visit reviews). */
export type AdminModerationReview = {
  id: string;
  rating: number;
  comment?: string;
  isVisible: boolean;
  isModerated: boolean;
  createdAt: string;
  patientName: string;
  /** The doctor / physiotherapist / nurse being reviewed. */
  providerName: string;
  /** "admin" = logged by an admin for feedback received off-platform. */
  source: "patient" | "admin";
};

export type AdminModerationReviewList = {
  reviews: AdminModerationReview[];
  total: number;
};
