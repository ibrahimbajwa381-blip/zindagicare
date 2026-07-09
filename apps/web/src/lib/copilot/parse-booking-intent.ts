import { resolveSpecialtyFromText } from "@/server/services/copilot-specialty-map";
import type { SlotPreference } from "@/server/services/copilot-slot-match";

export type BookingIntentAction = "find" | "book";

export type ParsedBookingIntent = {
  action: BookingIntentAction | null;
  specialty?: string;
  preferences: SlotPreference;
  confidence: "high" | "low";
};

const BOOK_PATTERNS = [
  /\bbook\b/i,
  /appointment\s+book/i,
  /book\s+(?:me|kar|karo|kro|kar\s*do|kardo)/i,
  /appointment\s+(?:kar|karo|kro|book)/i,
  /bana\s*do/i,
  /book\s*kar\s*do/i,
  /mujhe\s+.+\s+book/i,
  /meri\s+.+\s+appointment/i,
];

const FIND_PATTERNS = [
  /\bfind\b/i,
  /\bshow\b/i,
  /\blook\s+for\b/i,
  /\bavailable\b/i,
  /\bdikha(?:o|en)\b/i,
  /\bdhoondh(?:o|en)\b/i,
  /\bchahiye\b/i,
  /\bneed\s+(?:a|an)\b/i,
];

function detectAction(text: string): BookingIntentAction | null {
  const normalized = text.toLowerCase();
  const isBook = BOOK_PATTERNS.some((pattern) => pattern.test(normalized));
  const isFind = FIND_PATTERNS.some((pattern) => pattern.test(normalized));

  if (isBook && !isFind) return "book";
  if (isFind && !isBook) return "find";
  if (isBook && isFind) {
    return /\bbook\b/i.test(normalized) ? "book" : "find";
  }
  if (/appointment/i.test(normalized) && /book|kar|karo|kro/i.test(normalized)) {
    return "book";
  }
  return null;
}

function parseSlotPreferences(text: string): SlotPreference {
  const normalized = text.toLowerCase();
  const preferences: SlotPreference = {
    preferHighestRated: true,
  };

  if (
    /within\s+(?:the\s+)?next\s+(?:hour|1\s*hour|60\s*min)/i.test(normalized) ||
    /aglay?\s*(?:ek\s+)?ghant(?:ay|e)/i.test(normalized) ||
    /next\s+hour/i.test(normalized) ||
    /1\s*hour\s+mein/i.test(normalized)
  ) {
    preferences.withinMinutes = 60;
    preferences.preferToday = true;
    preferences.preferTomorrow = false;
  }

  const mentionsTomorrow = /\btomorrow\b/i.test(normalized) || /\bkal\b/i.test(normalized);
  const mentionsMorning = /\bmorning\b/i.test(normalized) || /\bsubah\b/i.test(normalized);
  const mentionsEvening =
    /\bevening\b/i.test(normalized) || /\bshaam\b/i.test(normalized) || /\bsham\b/i.test(normalized);

  if (mentionsTomorrow) {
    preferences.preferTomorrow = true;
    preferences.preferToday = false;
  }

  if (mentionsMorning) {
    preferences.preferMorning = true;
  }

  if (mentionsEvening) {
    preferences.preferEvening = true;
  }

  if (
    /highest[\s-]?rated/i.test(normalized) ||
    /\btop[\s-]?rated\b/i.test(normalized) ||
    /\bbest\b/i.test(normalized) ||
    /\baach[ae]\b/i.test(normalized) ||
    /\bachh[ae]\b/i.test(normalized) ||
    /\bbehtareen\b/i.test(normalized) ||
    /\bbehtar\b/i.test(normalized)
  ) {
    preferences.preferHighestRated = true;
  }

  if (!preferences.preferTomorrow && !preferences.withinMinutes) {
    preferences.preferToday = preferences.preferToday ?? true;
  }

  return preferences;
}

export function parseBookingIntent(text: string): ParsedBookingIntent {
  const specialty =
    resolveSpecialtyFromText(text) ??
    (/\bskin\s+specialist\b/i.test(text)
      ? "Dermatologist"
      : /\bgeneral\s+physician\b/i.test(text)
        ? "General Physician"
        : undefined);

  const action = detectAction(text);
  const preferences = parseSlotPreferences(text);

  const confidence: ParsedBookingIntent["confidence"] =
    specialty && action ? "high" : specialty || action ? "low" : "low";

  return { action, specialty, preferences, confidence };
}

export function bookingIntentToolArgs(intent: ParsedBookingIntent): Record<string, unknown> {
  const args: Record<string, unknown> = {
    specialty: intent.specialty,
    preferHighestRated: intent.preferences.preferHighestRated !== false,
  };

  if (intent.preferences.preferTomorrow) args.preferTomorrow = true;
  if (intent.preferences.preferMorning) args.preferMorning = true;
  if (intent.preferences.preferEvening) args.preferEvening = true;
  if (intent.preferences.withinMinutes) {
    if (intent.preferences.withinMinutes === 60) {
      args.withinNextHour = true;
    } else {
      args.withinMinutes = intent.preferences.withinMinutes;
    }
  }
  if (intent.preferences.preferToday === false) args.preferToday = false;

  return args;
}

export function formatBookingIntentForPrompt(intent: ParsedBookingIntent): string {
  if (!intent.specialty && !intent.action) return "";

  const lines = [
    "PARSED PATIENT REQUEST (mandatory — call the matching tool with these parameters; never say you cannot filter by rating or time):",
  ];

  if (intent.action) lines.push(`- action: ${intent.action}`);
  if (intent.specialty) lines.push(`- specialty: ${intent.specialty}`);
  if (intent.preferences.withinMinutes) {
    lines.push(
      `- withinMinutes: ${intent.preferences.withinMinutes}${
        intent.preferences.withinMinutes === 60 ? " (withinNextHour: true)" : ""
      }`,
    );
  }
  if (intent.preferences.preferTomorrow) lines.push("- preferTomorrow: true");
  if (intent.preferences.preferMorning) lines.push("- preferMorning: true");
  if (intent.preferences.preferEvening) lines.push("- preferEvening: true");
  if (intent.preferences.preferHighestRated !== false) {
    lines.push("- preferHighestRated: true");
  }
  if (intent.action === "book") {
    lines.push("- tool: book_appointment");
  } else if (intent.action === "find") {
    lines.push("- tool: refer_doctors");
  }

  return lines.join("\n");
}
