const DR_PREFIX_RE = /^dr\.?\s*/i;

/**
 * Ensures a doctor's display name starts with "Dr." (doctors often omit it, or use
 * inconsistent variants like "Dr", "DR", "Dr.Name" with no space). Normalizes any
 * existing prefix instead of blindly prepending, so it never doubles up as "Dr. Dr. Name".
 */
export function withDoctorTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const match = trimmed.match(DR_PREFIX_RE);
  if (match) {
    const matched = match[0];
    // Only treat it as an existing title if it was followed by a space or a period
    // (e.g. "Dr Ahmed", "Dr. Ahmed", "Dr.Ahmed") — not for names like "Drake" or "Draupadi".
    const hasSeparator = /\s/.test(matched) || matched.includes(".");
    if (hasSeparator) {
      const rest = trimmed.slice(matched.length).trim();
      return rest ? `Dr. ${rest}` : trimmed;
    }
  }

  return `Dr. ${trimmed}`;
}
