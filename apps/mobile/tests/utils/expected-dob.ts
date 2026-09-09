/**
 * Mirrors the signup screen's age -> dateOfBirth synthesis (app/(auth)/signup.tsx):
 * today's month/day, not January 1st, so the server's re-derived age matches
 * the entered age exactly regardless of when in the year signup happens.
 */
export function expectedDateOfBirth(ageYears: number, from = new Date()): string {
  const birthDate = new Date(from.getFullYear() - ageYears, from.getMonth(), from.getDate());
  return `${birthDate.getFullYear()}-${String(birthDate.getMonth() + 1).padStart(2, "0")}-${String(birthDate.getDate()).padStart(2, "0")}`;
}
