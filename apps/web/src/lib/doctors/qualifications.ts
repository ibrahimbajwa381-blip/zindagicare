/** Parse comma/semicolon/newline-separated qualification text into a deduplicated list. */
export function parseQualificationsInput(raw: string): string[] {
  const items = raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 80);

  return [...new Set(items)].slice(0, 12);
}

export function formatQualificationsList(
  medicalDegree?: string | null,
  qualifications: readonly string[] = [],
): string[] {
  const entries: string[] = [];
  if (medicalDegree?.trim()) entries.push(medicalDegree.trim());
  for (const item of qualifications) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (entries.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) continue;
    entries.push(trimmed);
  }
  return entries;
}
