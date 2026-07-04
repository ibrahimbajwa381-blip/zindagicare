/** How the assistant should reply — mirrors the patient's message form. */
export type CopilotReplyLanguage = "en" | "ur-script" | "ur-roman";

const ROMAN_URDU_PATTERNS = [
  /\bmujhe\b/i,
  /\bmjhe\b/i,
  /\bmujhko\b/i,
  /\bkya\b/i,
  /\bkyun\b/i,
  /\bkyon\b/i,
  /\bhai\b/i,
  /\bhein\b/i,
  /\bhain\b/i,
  /\bho\b/i,
  /\bka\b/i,
  /\bki\b/i,
  /\bke\b/i,
  /\bko\b/i,
  /\bse\b/i,
  /\bmein\b/i,
  /\bmen\b/i,
  /\bmera\b/i,
  /\bmeri\b/i,
  /\bmere\b/i,
  /\baap\b/i,
  /\bap\b/i,
  /\btum\b/i,
  /\bnahi\b/i,
  /\bnahin\b/i,
  /\bhaan\b/i,
  /\bhan\b/i,
  /\bchahiye\b/i,
  /\bchahye\b/i,
  /\bkro\b/i,
  /\bkaro\b/i,
  /\bkarna\b/i,
  /\bkrna\b/i,
  /\bkarni\b/i,
  /\bbatao\b/i,
  /\bbatayein\b/i,
  /\bbataiye\b/i,
  /\bdard\b/i,
  /\bbukhar\b/i,
  /\bmasla\b/i,
  /\bmasle\b/i,
  /\bjaldi\b/i,
  /\baaj\b/i,
  /\bkal\b/i,
  /\btheek\b/i,
  /\bthik\b/i,
  /\bsalam\b/i,
  /\bji\b/i,
  /\bshukriya\b/i,
  /\bdaktar\b/i,
  /\bdoctor\s+(chahiye|batao|refer)/i,
  /\brefer\s+kro\b/i,
  /\bbook\s+kro\b/i,
  /\bappointment\s+book\b/i,
] as const;

/** Detect reply language from the patient's latest message. */
export function detectMessageLanguage(text: string): CopilotReplyLanguage {
  const trimmed = text.trim();
  if (!trimmed) return "en";

  const urduScriptCount = (trimmed.match(/[\u0600-\u06FF]/g) ?? []).length;
  if (urduScriptCount > trimmed.length * 0.12) {
    return "ur-script";
  }

  for (const pattern of ROMAN_URDU_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "ur-roman";
    }
  }

  return "en";
}

/** Collapse to legacy en/ur for session storage and TTS. */
export function toLegacyLocale(language: CopilotReplyLanguage): "en" | "ur" {
  return language === "en" ? "en" : "ur";
}

export function replyLanguageInstruction(language: CopilotReplyLanguage): string {
  switch (language) {
    case "en":
      return "Reply in English only.";
    case "ur-script":
      return "Reply in Urdu using Arabic/Persian script (اردو) only. Do not use Roman Urdu or English.";
    case "ur-roman":
      return "Reply in Roman Urdu using Latin letters only (e.g. mjhe, aap, kya, hai). Do not use Arabic script or English.";
  }
}

/** @deprecated Use detectMessageLanguage */
export function detectMessageLocale(text: string): "en" | "ur" {
  return toLegacyLocale(detectMessageLanguage(text));
}
