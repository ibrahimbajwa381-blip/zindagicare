const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Hard cap on a single send so a slow/hung provider call can never stall a
 * request path (booking confirmation, etc.) beyond a few seconds.
 */
const SEND_TIMEOUT_MS = 5000;

export type EmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /**
   * Resend drops a repeat send carrying the same key for 24 hours, so a
   * retried or replayed booking event can't email the same person twice.
   */
  idempotencyKey?: string;
};

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const rawFrom = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !rawFrom) return null;

  // EMAIL_FROM may be "name@domain.com" or already "Name <name@domain.com>".
  const from = /<.+>/.test(rawFrom) ? rawFrom : `ZindagiCare <${rawFrom}>`;
  return { apiKey, from };
}

export function isEmailConfigured(): boolean {
  return Boolean(resendConfig());
}

/**
 * Send a transactional email via Resend's HTTP API. Provider-agnostic call
 * sites only ever see this function — swapping providers later means
 * changing this file, nothing else.
 *
 * Never throws: callers get a result object and decide whether a failed
 * send should affect the surrounding flow (it usually shouldn't — email is
 * a best-effort notification channel, not the source of truth).
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  // Jest loads the real .env — never let a test run reach the live provider.
  if (process.env.NODE_ENV === "test") {
    return { ok: false, skipped: true };
  }

  const config = resendConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email][dev-skip]", input.to, input.subject);
    }
    return { ok: false, skipped: true };
  }

  const to = (Array.isArray(input.to) ? input.to : [input.to])
    .map((addr) => addr.trim())
    .filter(Boolean);
  if (to.length === 0) {
    return { ok: false, error: "no_recipient" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[email] send failed", res.status, errText.slice(0, 500));
      return { ok: false, error: `resend_${res.status}` };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    console.error("[email] send error", err);
    return {
      ok: false,
      error: isTimeout ? "timeout" : err instanceof Error ? err.message : "send_failed",
    };
  }
}

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
/** Resend accepts at most 100 messages per batch call. */
export const EMAIL_BATCH_LIMIT = 100;
const BATCH_TIMEOUT_MS = 15000;

export type BatchEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send up to EMAIL_BATCH_LIMIT separate emails in one Resend call. Each
 * message is delivered individually, so recipients never see each other.
 *
 * Never throws — same contract as sendEmail.
 */
export async function sendEmailBatch(
  messages: BatchEmailMessage[],
  options: { idempotencyKey?: string } = {},
): Promise<EmailSendResult> {
  if (process.env.NODE_ENV === "test") {
    return { ok: false, skipped: true };
  }

  const config = resendConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email][dev-skip] batch", messages.length);
    }
    return { ok: false, skipped: true };
  }
  if (messages.length === 0) return { ok: false, error: "no_recipient" };
  if (messages.length > EMAIL_BATCH_LIMIT) return { ok: false, error: "batch_too_large" };

  try {
    const res = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: JSON.stringify(
        messages.map((m) => ({
          from: config.from,
          to: [m.to.trim()],
          subject: m.subject,
          html: m.html,
          text: m.text,
        })),
      ),
      signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[email] batch send failed", res.status, errText.slice(0, 500));
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    console.error("[email] batch send error", err);
    return {
      ok: false,
      error: isTimeout ? "timeout" : err instanceof Error ? err.message : "send_failed",
    };
  }
}
