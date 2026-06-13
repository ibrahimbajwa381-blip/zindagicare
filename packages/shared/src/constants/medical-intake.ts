/**
 * Pre-consult medical history intake.
 * Default question set used when a doctor has not customized their own list.
 */
export interface IntakeQuestionDefinition {
  key: string;
  text: string;
}

export type IntakeLocale = "en" | "ur";

export const DEFAULT_INTAKE_QUESTIONS: readonly IntakeQuestionDefinition[] = [
  {
    key: "chief_complaint",
    text: "What is the main health concern you would like to discuss with the doctor?",
  },
  {
    key: "symptom_duration",
    text: "How long have you had these symptoms, and have they been getting better or worse?",
  },
  {
    key: "current_medications",
    text: "Are you currently taking any medicines, supplements, or home remedies? If yes, please list them.",
  },
  {
    key: "allergies",
    text: "Do you have any allergies (medicines, foods, or anything else)? If yes, please describe.",
  },
  {
    key: "chronic_conditions",
    text: "Do you have any ongoing medical conditions (e.g. diabetes, blood pressure, asthma, heart disease)?",
  },
  {
    key: "past_surgeries",
    text: "Have you had any surgeries or hospital admissions in the past? If yes, please give details.",
  },
  {
    key: "family_history",
    text: "Does anyone in your immediate family have major health conditions (e.g. diabetes, heart disease, cancer)?",
  },
  {
    key: "additional_info",
    text: "Is there anything else you would like the doctor to know before your consultation?",
  },
] as const;

export const DEFAULT_INTAKE_QUESTIONS_UR: readonly IntakeQuestionDefinition[] = [
  {
    key: "chief_complaint",
    text: "آپ ڈاکٹر سے کس بنیادی صحت کے مسئلے کے بارے میں بات کرنا چاہتے ہیں؟",
  },
  {
    key: "symptom_duration",
    text: "یہ علامات کب سے ہیں، اور کیا وہ بہتر ہو رہی ہیں یا بدتر؟",
  },
  {
    key: "current_medications",
    text: "کیا آپ فی الحال کوئی دوائیں، سپلیمنٹس یا گھریلو نسخے استعمال کر رہے ہیں؟ اگر ہاں، تو براہ کرم فہرست بنائیں۔",
  },
  {
    key: "allergies",
    text: "کیا آپ کو کوئی الرجی ہے (دوائیں، کھانے، یا کچھ اور)؟ اگر ہاں، تو براہ کرم بتائیں۔",
  },
  {
    key: "chronic_conditions",
    text: "کیا آپ کو کوئی مسلسل طبی حالت ہے (مثلاً ذیابیطس، بلڈ پریشر، دمہ، دل کی بیماری)؟",
  },
  {
    key: "past_surgeries",
    text: "کیا آپ ماضی میں کسی سرجری یا ہسپتال میں داخلہ کے تجربے سے گزرے ہیں؟ اگر ہاں، تو تفصیل دیں۔",
  },
  {
    key: "family_history",
    text: "کیا آپ کے قریبی خاندان میں کسی کو بڑی صحت کی حالت ہے (مثلاً ذیابیطس، دل کی بیماری، کینسر)؟",
  },
  {
    key: "additional_info",
    text: "کیا مشاورت سے پہلے ڈاکٹر کو کچھ اور بتانا چاہیں گے؟",
  },
] as const;

export function getDefaultIntakeQuestions(locale: IntakeLocale = "en") {
  return locale === "ur" ? DEFAULT_INTAKE_QUESTIONS_UR : DEFAULT_INTAKE_QUESTIONS;
}

export const MEDICAL_INTAKE_CONFIG = {
  maxQuestions: 20,
  maxQuestionLength: 300,
  maxAnswerLength: 2000,
  assistantName: "ZindagiCare Assistant",
} as const;

export const INTAKE_INTRO_MESSAGE =
  "Assalam-o-Alaikum! Before your consultation, please answer a few quick questions about your medical history. This helps the doctor prepare and makes your consultation more focused. Simply reply to each question below.";

export const INTAKE_INTRO_MESSAGE_UR =
  "السلام علیکم! مشاورت سے پہلے، براہ کرم اپنی طبی تاریخ کے چند مختصر سوالات کے جواب دیں۔ اس سے ڈاکٹر تیار ہو سکتا ہے اور آپ کی مشاورت زیادہ مرکوز رہتی ہے۔ نیچے ہر سوال کا جواب لکھ کر بھیجیں۔";

export const INTAKE_COMPLETE_MESSAGE =
  "Thank you! Your medical history has been shared with the doctor. You can now use this chat to message the doctor directly.";

export const INTAKE_COMPLETE_MESSAGE_UR =
  "شکریہ! آپ کی طبی تاریخ ڈاکٹر کے ساتھ شیئر کر دی گئی ہے۔ اب آپ اس چیٹ میں براہ راست ڈاکٹر کو پیغام بھیج سکتے ہیں۔";

export function getIntakeIntroMessage(locale: IntakeLocale = "en") {
  return locale === "ur" ? INTAKE_INTRO_MESSAGE_UR : INTAKE_INTRO_MESSAGE;
}

export function getIntakeCompleteMessage(locale: IntakeLocale = "en") {
  return locale === "ur" ? INTAKE_COMPLETE_MESSAGE_UR : INTAKE_COMPLETE_MESSAGE;
}

export function formatIntakeQuestion(
  text: string,
  number: number,
  total: number,
  locale: IntakeLocale = "en",
) {
  if (locale === "ur") {
    return `سوال ${number} از ${total}: ${text}`;
  }
  return `Question ${number} of ${total}: ${text}`;
}

export function normalizeIntakeLocale(value?: string | null): IntakeLocale {
  return value === "ur" ? "ur" : "en";
}

/** Localized display text for a snapshotted question (defaults by key; custom text unchanged). */
export function resolveIntakeQuestionText(
  question: { key: string; text: string },
  locale: IntakeLocale,
): string {
  const match = getDefaultIntakeQuestions(locale).find((q) => q.key === question.key);
  if (match && getDefaultIntakeQuestions("en").some((q) => q.key === question.key)) {
    return match.text;
  }
  return question.text;
}

/** Re-localize stored English intake bot messages for the active UI language. */
export function localizeIntakeSystemMessage(
  body: string,
  locale: IntakeLocale,
): string {
  if (locale === "en") return body;

  const legacyIntro =
    "Assalam-o-Alaikum! Before your consultation, please answer a few quick questions about your medical history. This helps the doctor makes your consultation more focused. Simply reply to each question below.";

  if (body === INTAKE_INTRO_MESSAGE || body === legacyIntro) {
    return INTAKE_INTRO_MESSAGE_UR;
  }
  if (body === INTAKE_COMPLETE_MESSAGE) {
    return INTAKE_COMPLETE_MESSAGE_UR;
  }

  const enMatch = body.match(/^Question (\d+) of (\d+): ([\s\S]+)$/);
  if (enMatch) {
    const [, num, total, text] = enMatch;
    const key = DEFAULT_INTAKE_QUESTIONS.find((q) => q.text === text.trim())?.key;
    if (key) {
      const urText =
        DEFAULT_INTAKE_QUESTIONS_UR.find((q) => q.key === key)?.text ?? text.trim();
      return formatIntakeQuestion(urText, Number(num), Number(total), "ur");
    }
  }

  return body;
}
