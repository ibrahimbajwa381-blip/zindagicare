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

export function doctorProfilePath(slug?: string | null, doctorId?: string) {
  if (slug?.trim()) return `/doctors/${slug.trim().toLowerCase()}`;
  if (doctorId?.trim()) return `/doctors/${doctorId.trim()}`;
  return "/doctors";
}
