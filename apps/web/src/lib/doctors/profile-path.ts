const MONGO_OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** URL-safe slug from display name (matches admin slug base logic). */
export function nameToDoctorSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "doctor"
  );
}

/** True when slug is a readable name segment (not ObjectId, CNIC, PMDC, or phone). */
export function isCanonicalDoctorSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  if (MONGO_OBJECT_ID_RE.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return /[a-z]/.test(normalized);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveDoctorSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  const trimmed = storedSlug?.trim().toLowerCase();
  if (trimmed && isCanonicalDoctorSlug(trimmed)) return trimmed;
  return nameToDoctorSlug(name);
}

export function doctorProfilePath(slug?: string | null, doctorId?: string) {
  if (slug?.trim() && isCanonicalDoctorSlug(slug)) {
    return `/doctors/${slug.trim().toLowerCase()}`;
  }
  if (doctorId?.trim()) return `/doctors/${doctorId.trim()}`;
  return "/doctors";
}
