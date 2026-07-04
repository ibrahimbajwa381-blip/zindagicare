/** Analyze and sanitize patient messages before they reach the LLM. */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your\s+)?(system|safety|rules)/i,
  /you\s+are\s+now\s+/i,
  /\bDAN\b/,
  /\bjailbreak\b/i,
  /\bact\s+as\s+(?:an?\s+)?(?:unrestricted|unfiltered)/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?instructions/i,
  /\bapi[_\s-]?key\b/i,
  /\bFIELD_ENCRYPTION_KEY\b/,
  /\bGEMINI_API_KEY\b/,
  /\bMONGODB_URI\b/,
  /<\s*script[\s>]/i,
  /\bon\w+\s*=/i,
  /\{\{\s*.*\s*\}\}/,
  /```\s*(?:system|assistant)/i,
];

const DISALLOWED_INTENT_PATTERNS = [
  /\bother\s+patients?\b/i,
  /\ball\s+users?\b/i,
  /\badmin\s+panel\b/i,
  /\bhack\b/i,
  /\bsql\s+injection\b/i,
  /\bdrop\s+table\b/i,
  /\bdelete\s+from\b/i,
  /prescription\s+for\s+someone\s+else/i,
  /\b\d{13}\b.*\bcnic\b/i,
];

export type CopilotInputAnalysis = {
  blocked: boolean;
  sanitized: string;
  reason?: "injection" | "disallowed" | "empty";
};

export function sanitizeCopilotUserInput(raw: string): string {
  return raw.replace(CONTROL_CHARS_RE, "").replace(/\s+/g, " ").trim().slice(0, 4000);
}

export function analyzeCopilotUserInput(raw: string): CopilotInputAnalysis {
  const sanitized = sanitizeCopilotUserInput(raw);
  if (!sanitized) {
    return { blocked: true, sanitized: "", reason: "empty" };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { blocked: true, sanitized, reason: "injection" };
    }
  }

  for (const pattern of DISALLOWED_INTENT_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { blocked: true, sanitized, reason: "disallowed" };
    }
  }

  return { blocked: false, sanitized };
}

export function refusalMessage(
  reason: CopilotInputAnalysis["reason"],
  locale: "en" | "ur",
): string {
  if (locale === "ur") {
    if (reason === "injection") {
      return "میں صرف ZindagiCare صحت کی مدد کے لیے ہوں — ڈاکٹر تلاش کریں، اپائنٹمنٹ بک کریں، یا علامات کے بارے میں پوچھیں۔";
    }
    return "میں یہ درخواست نہیں کر سکتا۔ براہ کرم اپنی صحت یا ZindagiCare سروسز کے بارے میں پوچھیں۔";
  }
  if (reason === "injection") {
    return "I'm only here to help with ZindagiCare health services — find doctors, book appointments, or ask about symptoms.";
  }
  return "I can't help with that request. Please ask about your health or ZindagiCare services.";
}

const ALLOWED_TOOL_NAMES = new Set([
  "assess_symptoms",
  "refer_doctors",
  "search_doctors",
  "get_doctor_slots",
  "suggest_booking",
  "book_appointment",
  "suggest_urgent_care",
  "suggest_sunday_consult",
  "suggest_home_care",
  "list_my_appointments",
  "list_my_prescriptions",
  "get_patient_health_summary",
  "get_service_links",
]);

export function isAllowedCopilotTool(name: string): boolean {
  return ALLOWED_TOOL_NAMES.has(name);
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const MAX_ARG_STRING = 500;

export function sanitizeToolArguments(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      out[key] = value
        .replace(CONTROL_CHARS_RE, "")
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, key === "patientNotes" || key === "prefillNotes" ? 2000 : MAX_ARG_STRING);
    } else if (typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value
        .filter((item) => typeof item === "string")
        .map((item) => String(item).slice(0, MAX_ARG_STRING));
    }
  }

  if ("doctorId" in out && typeof out.doctorId === "string" && !OBJECT_ID_RE.test(out.doctorId)) {
    delete out.doctorId;
  }

  if ("slotId" in out && typeof out.slotId === "string" && out.slotId.length > 120) {
    delete out.slotId;
  }

  void name;
  return out;
}
