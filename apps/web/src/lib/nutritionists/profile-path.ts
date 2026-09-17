import {
  buildProfilePath,
  isCanonicalProfileSlug,
  nameToProfileSlug,
  resolveProfileSlug,
} from "@/lib/shared/profile-slug";

/** URL-safe slug from display name. */
export function nameToNutritionistSlug(name: string): string {
  return nameToProfileSlug(name, "nutritionist");
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalNutritionistSlug(slug: string): boolean {
  return isCanonicalProfileSlug(slug);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveNutritionistSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  return resolveProfileSlug(storedSlug, name, "nutritionist");
}

export function nutritionistProfilePath(slug?: string | null, nutritionistId?: string): string {
  return buildProfilePath("/nutritionists", slug, nutritionistId);
}
