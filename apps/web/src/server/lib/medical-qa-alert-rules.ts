import { normalizeUserText, type MedicalQaCategory } from "@zindagi/validators";
import { en } from "@/i18n/dictionaries/en";

/**
 * Pure rules for new-question alerts to professionals: who a topic reaches,
 * what the notification says, quiet hours and retry backoff. Rule-based on
 * purpose (no inference from question text); the topic is the validated
 * category stored on the question.
 */
export const QUESTION_ALERT_CONFIG = {
  /** Characters of the public question title shown in the preview. */
  previewMaxChars: 80,
  /** At most one push per professional in this window; extra alerts stay in-app. */
  pushThrottle: { limit: 1, windowMs: 15 * 60 * 1000 },
  /** Push is skipped (in-app kept) from 22:00 to 08:00 Pakistan time. */
  quietHours: { startHour: 22, endHour: 8, timeZone: "Asia/Karachi" },
  /** Initial run + retries, per question and per push. */
  maxAttempts: 4,
  /** How long one worker may hold a question before another can take over. */
  leaseMs: 5 * 60 * 1000,
  /** Each provider call is abandoned after this long. */
  pushTimeoutMs: 10_000,
  /** Pushes in flight at once (Expo/web-push rate limits). */
  concurrency: 10,
  /** Safety bound on one fan-out. */
  maxRecipients: 5000,
  /** The sweep only retries questions this recent; older alerts are no longer useful. */
  retryWindowMs: 24 * 60 * 60 * 1000,
} as const;

export type AlertRecipientRole = "doctor" | "nurse" | "physiotherapist";

export type TopicRecipientRule =
  | { kind: "doctors"; specialties: readonly string[] | null }
  | { kind: "staff"; staffType: "nurse" | "physiotherapist" };

const ALL_DOCTORS: TopicRecipientRule = { kind: "doctors", specialties: null };

/**
 * Topic → who is alerted. Specialty names are platform constants (SPECIALTIES)
 * matched against the admin-verified `DoctorProfile.specialties` field.
 * A specialty topic with no eligible match falls back to all doctors.
 */
const TOPIC_RULES: Record<MedicalQaCategory, TopicRecipientRule> = {
  general: ALL_DOCTORS,
  medicines: ALL_DOCTORS,
  other: ALL_DOCTORS,
  physiotherapy: { kind: "staff", staffType: "physiotherapist" },
  "nursing-care": { kind: "staff", staffType: "nurse" },
  skin: { kind: "doctors", specialties: ["Dermatologist", "Cosmetologist", "Aesthetic Physician"] },
  "mental-health": {
    kind: "doctors",
    specialties: ["Psychiatrist", "Psychologist", "Counselor", "Pediatric Psychologist"],
  },
  "heart-bp": {
    kind: "doctors",
    specialties: ["Cardiologist", "Interventional Cardiologist", "Hypertension Specialist"],
  },
  children: { kind: "doctors", specialties: ["Pediatrician", "Neonatologist"] },
  women: { kind: "doctors", specialties: ["Gynecologist", "Obstetrician", "Fertility Consultant"] },
  diabetes: { kind: "doctors", specialties: ["Diabetologist", "Endocrinologist"] },
  stomach: { kind: "doctors", specialties: ["Gastroenterologist", "Hepatologist"] },
  "bones-joints": { kind: "doctors", specialties: ["Orthopedic Surgeon", "Pain Management Specialist"] },
};

export function topicRecipientRule(topic: MedicalQaCategory): TopicRecipientRule {
  // Own-property check: "__proto__"/"constructor" can never resolve to a rule.
  if (!Object.hasOwn(TOPIC_RULES, topic)) throw new Error("Unknown question topic");
  return TOPIC_RULES[topic];
}

export function allDoctorsRule(): TopicRecipientRule {
  return ALL_DOCTORS;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Digit runs with common separators; replaced only when they hold 7+ digits
// (phone numbers, CNICs) so "3 days" or "500mg" stay readable.
const LONG_NUMBER = /\+?\d[\d\s\-().]{5,}\d/g;

function maskIdentifiers(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(LONG_NUMBER, (match) => (match.replace(/\D/g, "").length >= 7 ? "[number]" : match));
}

function truncateChars(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** Plain-text, length-limited preview of the (already public) question title. */
export function questionPreview(title: string): string {
  const flat = normalizeUserText(title).replace(/\s+/g, " ").trim();
  return truncateChars(maskIdentifiers(flat), QUESTION_ALERT_CONFIG.previewMaxChars);
}

export type QuestionAlertContent = {
  title: string;
  body: string;
  url: string;
  payload: { type: "medical_question_new"; questionId: string; category: MedicalQaCategory; url: string };
};

/**
 * Notification text for one question. Uses only the id, topic and public
 * title — never the question body, author, or photo URLs. Output is plain
 * text; every surface (in-app list, Expo, web push) renders it as text.
 */
export function buildQuestionAlertContent(question: {
  id: string;
  category: MedicalQaCategory;
  title: string;
}): QuestionAlertContent {
  const url = `/questions/${question.id}`;
  const preview = questionPreview(question.title);
  return {
    title: `New question · ${en.medicalQa.categories[question.category]}`,
    body: preview
      ? `"${preview}" — tap to read and answer.`
      : "A new question is waiting in your area of expertise.",
    url,
    payload: { type: "medical_question_new", questionId: question.id, category: question.category, url },
  };
}

const pkHour = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: QUESTION_ALERT_CONFIG.quietHours.timeZone,
});

export function isQuietHours(now: Date): boolean {
  const hour = Number(pkHour.format(now));
  const { startHour, endHour } = QUESTION_ALERT_CONFIG.quietHours;
  return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
}

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** Delay before retry number `attempt` (1-based), capped at one hour. */
export function retryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempt, 1), RETRY_DELAYS_MS.length) - 1];
}
