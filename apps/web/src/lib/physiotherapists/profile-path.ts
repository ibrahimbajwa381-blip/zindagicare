import {
  buildProfilePath,
  isCanonicalProfileSlug,
  nameToProfileSlug,
  resolveProfileSlug,
} from "@/lib/shared/profile-slug";

/** URL-safe slug from display name. */
export function nameToPhysiotherapistSlug(name: string): string {
  return nameToProfileSlug(name, "physiotherapist");
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalPhysiotherapistSlug(slug: string): boolean {
  return isCanonicalProfileSlug(slug);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolvePhysiotherapistSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  return resolveProfileSlug(storedSlug, name, "physiotherapist");
}

export function physiotherapistProfilePath(slug?: string | null, physiotherapistId?: string): string {
  return buildProfilePath("/physiotherapists", slug, physiotherapistId);
}
