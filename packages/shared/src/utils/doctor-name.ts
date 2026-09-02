const DR_PREFIX_RE = /^dr\.?\s+/i;

/** Ensures a doctor's display name starts with "Dr." (doctors often omit it themselves). */
export function withDoctorTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (DR_PREFIX_RE.test(trimmed)) return trimmed;
  return `Dr. ${trimmed}`;
}
