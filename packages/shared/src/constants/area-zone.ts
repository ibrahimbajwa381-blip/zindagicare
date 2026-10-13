export type AreaZone = { zone: string; areas: readonly string[] };

/** "DHA Phase" × 3 → DHA Phase 1, DHA Phase 2, DHA Phase 3. */
export const phases = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

/** "Model Town Block" × "AB" → Model Town Block A, Model Town Block B. */
export const blocks = (prefix: string, letters: string) =>
  [...letters].map((letter) => `${prefix} ${letter}`);
