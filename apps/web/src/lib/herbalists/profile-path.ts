import {
  buildProfilePath,
  isCanonicalProfileSlug,
  nameToProfileSlug,
  resolveProfileSlug,
} from "@/lib/shared/profile-slug";

/** URL-safe slug from display name. */
export function nameToHerbalistSlug(name: string): string {
  return nameToProfileSlug(name, "herbalist");
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalHerbalistSlug(slug: string): boolean {
  return isCanonicalProfileSlug(slug);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveHerbalistSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  return resolveProfileSlug(storedSlug, name, "herbalist");
}

export function herbalistProfilePath(slug?: string | null, herbalistId?: string): string {
  return buildProfilePath("/herbalists", slug, herbalistId);
}
