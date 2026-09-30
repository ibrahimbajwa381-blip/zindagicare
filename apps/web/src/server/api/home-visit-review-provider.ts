import {
  AppError,
  ErrorCodes,
  isHomeVisitProviderKind,
  type HomeVisitProviderKind,
} from "@zindagi/shared";

/**
 * Provider kind from /api/v1/admin/home-visit-reviews/<provider>/... — read off the URL
 * so route handlers can be built once at module scope (see withApiHandler).
 */
export function homeVisitReviewProviderFromUrl(url: string): HomeVisitProviderKind {
  const segments = new URL(url).pathname.split("/");
  const index = segments.indexOf("home-visit-reviews");
  const value = index >= 0 ? segments[index + 1] : undefined;
  if (!isHomeVisitProviderKind(value)) {
    throw new AppError("Unknown provider type", ErrorCodes.NOT_FOUND, 404);
  }
  return value;
}
