const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** URL-safe slug from display name. */
export function nameToNutritionistSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "nutritionist"
  );
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalNutritionistSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  if (MONGO_OBJECT_ID_RE.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return /[a-z]/.test(normalized);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveNutritionistSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  const trimmed = storedSlug?.trim().toLowerCase();
  if (trimmed && isCanonicalNutritionistSlug(trimmed)) return trimmed;
  return nameToNutritionistSlug(name);
}

export function nutritionistProfilePath(slug?: string | null, nutritionistId?: string) {
  if (slug?.trim() && isCanonicalNutritionistSlug(slug)) {
    return `/nutritionists/${slug.trim().toLowerCase()}`;
  }
  if (nutritionistId?.trim()) return `/nutritionists/${nutritionistId.trim()}`;
  return "/nutritionists";
}
