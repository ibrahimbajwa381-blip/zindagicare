import { z } from "zod";

/**
 * Public medical Q&A limits. Single source of truth for the API, the
 * service layer and the ask/answer forms.
 */
export const MEDICAL_QA_LIMITS = {
  titleMin: 10,
  titleMax: 150,
  bodyMin: 20,
  bodyMax: 3000,
  answerMin: 2,
  answerMax: 3000,
  maxAttachments: 3,
  reportDetailsMax: 500,
  pageSizeDefault: 20,
  pageSizeMax: 50,
  searchMax: 80,
  /** JSON request bodies above this are refused before parsing. */
  maxJsonBodyBytes: 32 * 1024,
} as const;

export const MedicalQaCategories = [
  "general",
  "children",
  "women",
  "skin",
  "mental-health",
  "bones-joints",
  "heart-bp",
  "diabetes",
  "stomach",
  "medicines",
  "physiotherapy",
  "nursing-care",
  "other",
] as const;

export type MedicalQaCategory = (typeof MedicalQaCategories)[number];

export const MedicalQaReportReasons = ["spam", "abusive", "misleading", "dangerous", "privacy", "other"] as const;
export type MedicalQaReportReason = (typeof MedicalQaReportReasons)[number];

// C0 controls except \t (09) and \n (0A); DEL; C1 controls.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
// Bidi embeddings/overrides/isolates (trojan-source style spoofing). ZWNJ/ZWJ
// (U+200C/U+200D) are deliberately kept — Urdu text needs them.
const BIDI_CONTROLS = /[‪-‮⁦-⁩]/g;

/**
 * Normalizes user-written medical text without altering meaning: NFC,
 * CRLF→LF, strip invisible control/bidi characters, collapse long blank
 * runs, trim. Symbols such as <, >, &, /, %, ≥ are left exactly as typed —
 * output encoding at render time is what makes them safe.
 */
export function normalizeUserText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_CONTROLS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function userText(min: number, max: number) {
  return z
    .string()
    // Bound the raw input before normalizing so huge strings are rejected cheaply.
    .max(max * 2)
    .transform(normalizeUserText)
    .pipe(
      z
        .string()
        .min(min, { message: `Must be at least ${min} characters` })
        .max(max, { message: `Must be at most ${max} characters` }),
    );
}

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, { message: "Invalid id" });

const idempotencyKeySchema = z.uuid();

/**
 * Topic chosen by the patient. Missing, null, empty or whitespace-only means
 * "no topic chosen" and becomes `general`; a string is trimmed and
 * lower-cased; anything else (unknown names, numbers, objects such as
 * `{ $ne: null }`) fails validation instead of being stored or matched.
 */
export const medicalQaTopicSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return "general";
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? "general" : trimmed;
}, z.enum(MedicalQaCategories));

export const createMedicalQuestionSchema = z.strictObject({
  category: medicalQaTopicSchema,
  title: userText(MEDICAL_QA_LIMITS.titleMin, MEDICAL_QA_LIMITS.titleMax),
  body: userText(MEDICAL_QA_LIMITS.bodyMin, MEDICAL_QA_LIMITS.bodyMax),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const createMedicalAnswerSchema = z.strictObject({
  body: userText(MEDICAL_QA_LIMITS.answerMin, MEDICAL_QA_LIMITS.answerMax),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const listMedicalQuestionsQuerySchema = z.strictObject({
  cursor: objectIdSchema.optional(),
  category: z.enum(MedicalQaCategories).optional(),
  filter: z.enum(["all", "unanswered", "mine"]).optional().default("all"),
  /** Plain-text search over title and body (matched literally, not as a pattern). */
  q: z
    .string()
    .max(MEDICAL_QA_LIMITS.searchMax * 2)
    .transform(normalizeUserText)
    .pipe(z.string().max(MEDICAL_QA_LIMITS.searchMax))
    .optional(),
  limit: z
    .string()
    .regex(/^\d{1,3}$/, { message: "Invalid limit" })
    .transform(Number)
    .pipe(z.number().int().min(1).max(MEDICAL_QA_LIMITS.pageSizeMax))
    .optional()
    .default(MEDICAL_QA_LIMITS.pageSizeDefault),
});

export const reportMedicalQaSchema = z.strictObject({
  targetType: z.enum(["question", "answer"]),
  targetId: objectIdSchema,
  reason: z.enum(MedicalQaReportReasons),
  details: z
    .string()
    .max(MEDICAL_QA_LIMITS.reportDetailsMax * 2)
    .transform(normalizeUserText)
    .pipe(z.string().max(MEDICAL_QA_LIMITS.reportDetailsMax))
    .optional(),
});

/** A professional's own new-question alert setting. The user is always the session user. */
export const medicalQaAlertPreferenceSchema = z.strictObject({
  questionAlerts: z.boolean(),
});

export const moderateMedicalQaReportSchema = z.strictObject({
  reportId: objectIdSchema,
  action: z.enum(["hide", "restore", "dismiss"]),
  note: z.string().max(500).transform(normalizeUserText).optional(),
});

export type CreateMedicalQuestionInput = z.infer<typeof createMedicalQuestionSchema>;
export type CreateMedicalAnswerInput = z.infer<typeof createMedicalAnswerSchema>;
export type ListMedicalQuestionsQuery = z.infer<typeof listMedicalQuestionsQuerySchema>;
export type ReportMedicalQaInput = z.infer<typeof reportMedicalQaSchema>;
export type MedicalQaAlertPreferenceInput = z.infer<typeof medicalQaAlertPreferenceSchema>;
export type ModerateMedicalQaReportInput = z.infer<typeof moderateMedicalQaReportSchema>;
