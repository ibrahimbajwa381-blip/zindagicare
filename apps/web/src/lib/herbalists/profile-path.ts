const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** URL-safe slug from display name. */
export function nameToHerbalistSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "herbalist"
  );
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalHerbalistSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  if (MONGO_OBJECT_ID_RE.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return /[a-z]/.test(normalized);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveHerbalistSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  const trimmed = storedSlug?.trim().toLowerCase();
  if (trimmed && isCanonicalHerbalistSlug(trimmed)) return trimmed;
  return nameToHerbalistSlug(name);
}

export function herbalistProfilePath(slug?: string | null, herbalistId?: string) {
  if (slug?.trim() && isCanonicalHerbalistSlug(slug)) {
    return `/herbalists/${slug.trim().toLowerCase()}`;
  }
  if (herbalistId?.trim()) return `/herbalists/${herbalistId.trim()}`;
  return "/herbalists";
}
