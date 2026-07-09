import type { CopilotMessageMetadata } from "@zindagi/validators";
import type { CopilotReplyLanguage } from "@/lib/copilot/detect-message-language";

const ENC_PREFIX = "enc:v1:";

export function containsEncryptedPayload(text: string): boolean {
  return text.includes(ENC_PREFIX);
}

export function isEncryptedAssistantContent(text: string): boolean {
  return text.trim().startsWith(ENC_PREFIX);
}

/** Remove ciphertext segments that the model may have echoed from tool output. */
export function stripEncryptedSegments(text: string): string {
  return text
    .replace(/enc:v1:[A-Za-z0-9_-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Build human-readable assistant text from metadata when model output is unusable. */
export function buildCopilotResponseText(
  rawContent: string,
  metadata: CopilotMessageMetadata | undefined,
  language: CopilotReplyLanguage,
): string {
  const cleaned = stripEncryptedSegments(rawContent);
  if (cleaned && !containsEncryptedPayload(cleaned)) {
    return cleaned;
  }

  if (metadata?.bookedAppointment) {
    const { doctorName, status } = metadata.bookedAppointment;
    if (language === "ur-script") {
      return status === "confirmed"
        ? `آپ کی اپائنٹمنٹ ${doctorName} کے ساتھ بک ہو گئی ہے۔`
        : `آپ کی اپائنٹمنٹ ${doctorName} کے ساتھ محفوظ ہے۔ براہ کرم ادائیگی مکمل کریں۔`;
    }
    if (language === "ur-roman") {
      return status === "confirmed"
        ? `Aap ki appointment ${doctorName} ke sath book ho gayi hai.`
        : `Aap ki appointment ${doctorName} ke sath secure hai. Barah-e-karam payment complete karein.`;
    }
    return status === "confirmed"
      ? `Your appointment with ${doctorName} is confirmed.`
      : `Your appointment with ${doctorName} is reserved. Please complete payment.`;
  }

  if (metadata?.doctorReferrals?.length) {
    const names = metadata.doctorReferrals.map((d) => d.name).join(", ");
    const specialty = metadata.doctorReferrals[0]?.specialties?.[0];
    if (language === "ur-script") {
      return specialty
        ? `یہاں دستیاب ${specialty} ہیں: ${names}۔`
        : `یہاں تجویز کردہ ڈاکٹر ہیں: ${names}۔`;
    }
    if (language === "ur-roman") {
      return specialty
        ? `Yahan available ${specialty} hain: ${names}.`
        : `Yahan recommended doctors hain: ${names}.`;
    }
    return specialty
      ? `Here are available ${specialty} on ZindagiCare: ${names}.`
      : `Here are recommended doctors: ${names}.`;
  }

  if (metadata?.bookingSuggestion) {
    const { doctorName, specialty, slotStartAt } = metadata.bookingSuggestion;
    const when = slotStartAt
      ? new Date(slotStartAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
    if (language === "ur-script") {
      return when
        ? `${doctorName}، ${specialty} — ${when} پر سلاٹ دستیاب ہے۔`
        : `${doctorName}، ${specialty} — مشاورت کے لیے سلاٹ دستیاب ہے۔`;
    }
    if (language === "ur-roman") {
      return when
        ? `${doctorName}, ${specialty} — ${when} par slot available hai.`
        : `${doctorName}, ${specialty} — consultation ke liye slot available hai.`;
    }
    return when
      ? `${doctorName}, ${specialty}, has a slot on ${when}.`
      : `${doctorName}, ${specialty}, has an available consultation slot.`;
  }

  if (metadata?.appointmentPreviews?.length) {
    const lines = metadata.appointmentPreviews.map(
      (a) => `${a.doctorName} (${a.specialty}) — ${new Date(a.scheduledStart).toLocaleString()}`,
    );
    if (language === "ur-script") {
      return `آپ کی آنے والی اپائنٹمنٹس: ${lines.join("; ")}`;
    }
    if (language === "ur-roman") {
      return `Aap ki upcoming appointments: ${lines.join("; ")}`;
    }
    return `Your upcoming appointments: ${lines.join("; ")}`;
  }

  if (metadata?.prescriptionPreviews?.length) {
    const names = metadata.prescriptionPreviews.map((p) => p.doctorName).join(", ");
    if (language === "ur-script") return `آپ کے حالیہ نسخے: ${names}`;
    if (language === "ur-roman") return `Aap ke recent prescriptions: ${names}`;
    return `Your recent prescriptions from: ${names}`;
  }

  if (metadata?.actionLinks?.length) {
    const labels = metadata.actionLinks.map((l) => l.label).join(", ");
    if (language === "ur-script") return `یہ سروسز دستیاب ہیں: ${labels}`;
    if (language === "ur-roman") return `Yeh services available hain: ${labels}`;
    return `You can use: ${labels}`;
  }

  if (metadata?.urgentCareSuggestion) {
    if (language === "ur-script") {
      return "آپ کی علامات فوری دیکھ بھال چاہ سکتی ہیں۔ فوری دیکھ بھال کا صفحہ کھولیں۔";
    }
    if (language === "ur-roman") {
      return "Aap ki alamaat urgent care cha sakti hain. Urgent care page kholen.";
    }
    return "Your symptoms may need urgent care. Open urgent care to see a doctor soon.";
  }

  if (language === "ur-script") return "یہ رہی آپ کی معلومات۔";
  if (language === "ur-roman") return "Yeh rahi aap ki maloomat.";
  return "Here is what I found for you.";
}

export function sanitizeCopilotDisplayText(
  rawContent: string,
  metadata: CopilotMessageMetadata | undefined,
  language: CopilotReplyLanguage = "en",
): string {
  if (
    !rawContent.trim() ||
    isEncryptedAssistantContent(rawContent) ||
    containsEncryptedPayload(rawContent)
  ) {
    if (metadata && Object.keys(metadata).length > 0) {
      return buildCopilotResponseText(rawContent, metadata, language);
    }
    if (language === "ur-script") {
      return "تفصیلات لوڈ ہو رہی ہیں — دوبارہ کوشش کریں۔";
    }
    if (language === "ur-roman") {
      return "Details load ho rahi hain — dobara koshish karein.";
    }
    return "Details are loading — please try again or rephrase your request.";
  }
  return rawContent;
}

/** Strip encrypted values from tool JSON before sending back to the model. */
export function sanitizeToolResultForModel(result: string): string {
  if (!containsEncryptedPayload(result)) return result;

  try {
    const parsed = JSON.parse(result) as unknown;
    return JSON.stringify(redactEncryptedValues(parsed));
  } catch {
    return stripEncryptedSegments(result);
  }
}

function redactEncryptedValues(value: unknown): unknown {
  if (typeof value === "string") {
    return value.startsWith(ENC_PREFIX) ? "" : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactEncryptedValues);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactEncryptedValues(nested)]),
    );
  }
  return value;
}
