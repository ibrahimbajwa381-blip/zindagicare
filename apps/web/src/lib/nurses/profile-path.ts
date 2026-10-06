import {
  buildProfilePath,
  isCanonicalProfileSlug,
  nameToProfileSlug,
  resolveProfileSlug,
} from "@/lib/shared/profile-slug";

/** URL-safe slug from display name. */
export function nameToNurseSlug(name: string): string {
  return nameToProfileSlug(name, "nurse");
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalNurseSlug(slug: string): boolean {
  return isCanonicalProfileSlug(slug);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveNurseSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  return resolveProfileSlug(storedSlug, name, "nurse");
}

export function nurseProfilePath(slug?: string | null, nurseId?: string): string {
  return buildProfilePath("/nurses", slug, nurseId);
}
