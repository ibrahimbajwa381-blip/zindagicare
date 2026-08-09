import { normalizePhoneDigits } from "@zindagi/validators";

export type WhatsAppSendResult = {
  ok: boolean;
  skipped?: boolean;
  provider?: "meta" | "http";
  error?: string;
};

/**
 * Normalize any Pakistani / E.164 phone to WhatsApp digits (no +), e.g. 923001234567.
 */
export function toWhatsAppDigits(raw: string): string | null {
  const digits = normalizePhoneDigits(raw.trim());
  if (!digits) return null;

  if (digits.startsWith("92") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function metaConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "v21.0",
  };
}

function httpConfig() {
  const apiKey = process.env.WHATSAPP_API_KEY?.trim();
  const apiUrl = process.env.WHATSAPP_API_URL?.trim();
  if (!apiKey || !apiUrl) return null;
  return {
    apiKey,
    apiUrl,
    format: (process.env.WHATSAPP_API_FORMAT?.trim().toLowerCase() || "auto") as
      | "auto"
      | "json"
      | "form",
  };
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(metaConfig() || httpConfig());
}

/** Comma-separated ops numbers that always receive admin WhatsApp alerts. */
export function getExtraAdminWhatsAppPhones(): string[] {
  const raw = process.env.WHATSAPP_ADMIN_PHONES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => toWhatsAppDigits(part))
    .filter((digits): digits is string => Boolean(digits));
}

function formatMessage(title: string | undefined, body: string): string {
  const brand = "ZindagiCare";
  if (!title) return `*${brand}*\n${body}`;
  return `*${brand} — ${title}*\n${body}`;
}

async function sendViaMeta(
  toDigits: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const config = metaConfig();
  if (!config) return { ok: false, skipped: true };

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en";

  const payload = templateName
    ? {
        messaging_product: "whatsapp",
        to: toDigits,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: text.slice(0, 1024) }],
            },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: toDigits,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[WhatsApp][meta] send failed", res.status, errText.slice(0, 500));
    return {
      ok: false,
      provider: "meta",
      error: `meta_${res.status}`,
    };
  }

  return { ok: true, provider: "meta" };
}

async function sendViaHttp(
  toDigits: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const config = httpConfig();
  if (!config) return { ok: false, skipped: true };

  const useForm =
    config.format === "form" ||
    (config.format === "auto" && /ultramsg\.com/i.test(config.apiUrl));

  let res: Response;
  if (useForm) {
    const body = new URLSearchParams({
      token: config.apiKey,
      to: `+${toDigits}`,
      body: text,
    });
    res = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } else {
    res = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({
        to: toDigits,
        phone: toDigits,
        text,
        body: text,
        message: text,
      }),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[WhatsApp][http] send failed", res.status, errText.slice(0, 500));
    return {
      ok: false,
      provider: "http",
      error: `http_${res.status}`,
    };
  }

  return { ok: true, provider: "http" };
}

/**
 * Send a WhatsApp message when a provider is configured.
 * Prefer Meta Cloud API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID);
 * otherwise use WHATSAPP_API_URL + WHATSAPP_API_KEY (Ultramsg / Wasender / etc.).
 */
export async function sendWhatsAppMessage(input: {
  to: string;
  body: string;
  title?: string;
}): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[WhatsApp][dev-skip]", input.to, input.title ?? "", input.body);
    }
    return { ok: false, skipped: true };
  }

  const toDigits = toWhatsAppDigits(input.to);
  if (!toDigits) {
    return { ok: false, error: "invalid_phone" };
  }

  const text = formatMessage(input.title, input.body);

  try {
    if (metaConfig()) {
      return await sendViaMeta(toDigits, text);
    }
    return await sendViaHttp(toDigits, text);
  } catch (err) {
    console.error("[WhatsApp] send error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}
