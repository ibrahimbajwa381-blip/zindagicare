import {
  buildProfilePath,
  isCanonicalProfileSlug,
  nameToProfileSlug,
  resolveProfileSlug,
} from "@/lib/shared/profile-slug";

/** Prefix "Dr." for display when the doctor's name doesn't already include a title. */
export function formatDoctorDisplayName(name: string): string {
  const trimmed = name.trim();
  if (/^(dr|prof|professor)\.?\s/i.test(trimmed)) return trimmed;
  return `Dr. ${trimmed}`;
}

/** URL-safe slug from display name (matches admin slug base logic). */
export function nameToDoctorSlug(name: string): string {
  return nameToProfileSlug(name, "doctor");
}

/** True when slug is a readable name segment (not ObjectId, CNIC, PMDC, or phone). */
export function isCanonicalDoctorSlug(slug: string): boolean {
  return isCanonicalProfileSlug(slug);
}

/** Prefer stored slug when canonical; otherwise derive from display name. */
export function resolveDoctorSlug(
  storedSlug: string | undefined | null,
  name: string,
): string {
  return resolveProfileSlug(storedSlug, name, "doctor");
}

export function doctorProfilePath(slug?: string | null, doctorId?: string): string {
  return buildProfilePath("/doctors", slug, doctorId);
}

/** Short, shareable link (/dr/<slug>) that permanently redirects to the full profile. */
export function doctorShortLinkPath(slug: string): string {
  return `/dr/${encodeURIComponent(slug)}`;
}
