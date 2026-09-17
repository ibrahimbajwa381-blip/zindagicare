const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** URL-safe slug from a display name, falling back to `fallback` when the name has no letters. */
export function nameToProfileSlug(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

/** True when slug is a readable name segment (not an ObjectId or bare digits). */
export function isCanonicalProfileSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  if (MONGO_OBJECT_ID_RE.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return /[a-z]/.test(normalized);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveProfileSlug(
  storedSlug: string | undefined | null,
  name: string,
  fallback: string,
): string {
  const trimmed = storedSlug?.trim().toLowerCase();
  if (trimmed && isCanonicalProfileSlug(trimmed)) return trimmed;
  return nameToProfileSlug(name, fallback);
}

/** Builds a `/{urlPrefix}/{slug|id}` profile path, preferring a canonical slug. */
export function buildProfilePath(
  urlPrefix: string,
  slug?: string | null,
  id?: string,
): string {
  if (slug?.trim() && isCanonicalProfileSlug(slug)) {
    return `${urlPrefix}/${slug.trim().toLowerCase()}`;
  }
  if (id?.trim()) return `${urlPrefix}/${id.trim()}`;
  return urlPrefix;
}
