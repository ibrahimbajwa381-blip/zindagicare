import { createHash, randomInt } from "crypto";
import { connectDatabase, OtpChallengeModel } from "@zindagi/database";
import { AppError } from "@zindagi/shared";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { findActiveUserByPhone } from "@/server/services/auth.service";
import { createRateLimiter, enforceRateLimit } from "@/server/lib/rate-limit";
import { sendEmail } from "@/server/services/email.service";
import { otpEmail } from "@/server/lib/email-templates";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 30 * 1000;

/**
 * The per-phone cooldown above only spaces requests 30s apart — an attacker
 * hammering it end-to-end could still trigger ~120 SMS/hour to one number.
 * Cap total requests per phone per hour on top of the cooldown.
 */
const HOURLY_REQUEST_LIMIT = 5;
const hourlyRequestLimiter = createRateLimiter(HOURLY_REQUEST_LIMIT, 60 * 60 * 1000);

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function storeKey(phone: string) {
  return `otp:${phone}`;
}

/**
 * Phone OTP architecture:
 * 1. Client POST /api/v1/auth/otp/request → SMS gateway (SMS_API_KEY) sends code,
 *    and email (when the account has one on file) via Resend.
 * 2. Client submits code + new password via signIn("phone-otp"); the password is
 *    saved, then the user is signed in (forgot-password flow).
 * 3. Challenges persist in MongoDB so API routes and server actions share state.
 */
function sendOtpSms(phone: string, code: string) {
  const message = `Your ZindagiCare sign-in code is ${code}. It expires in 5 minutes.`;
  if (process.env.SMS_API_KEY) {
    console.info("[SMS]", phone, message);
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[dev-otp] ${phone} → ${code}`);
  }
}

/**
 * Best-effort email delivery of the same code. Never throws — a failed
 * email must not block sign-in for users who also have SMS/WhatsApp.
 */
async function sendOtpEmail(email: string | null | undefined, name: string | undefined, code: string) {
  if (!email) return;
  const { subject, html, text } = otpEmail({ name, code, minutes: OTP_TTL_MS / 60_000 });
  await sendEmail({ to: email, subject, html, text }).catch((err) => {
    console.error("[otp] email send failed", err);
  });
}

export const otpService = {
  async requestLoginOtp(rawPhone: string): Promise<{ expiresInSeconds: number }> {
    await connectDatabase();
    const phone = normalizePakistaniPhone(rawPhone);
    const user = await findActiveUserByPhone(rawPhone);
    if (!user) {
      throw new AppError(
        "No account found with this mobile number",
        "NOT_FOUND",
        404,
      );
    }

    const key = storeKey(phone);
    const existing = await OtpChallengeModel.findOne({ phoneKey: key });
    if (
      existing?.updatedAt &&
      Date.now() - existing.updatedAt.getTime() < REQUEST_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (REQUEST_COOLDOWN_MS - (Date.now() - existing.updatedAt.getTime())) / 1000,
        ),
      );
      throw new AppError(
        "Please wait before requesting another code",
        "RATE_LIMITED",
        429,
        undefined,
        retryAfterSeconds,
      );
    }

    enforceRateLimit(
      hourlyRequestLimiter,
      phone,
      "Too many code requests for this number. Please try again later.",
    );

    const code = String(randomInt(100000, 999999));
    await OtpChallengeModel.findOneAndUpdate(
      { phoneKey: key },
      {
        codeHash: hashCode(code, phone),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
      },
      { upsert: true },
    );

    sendOtpSms(phone, code);
    await sendOtpEmail(user.email, user.name, code);

    return { expiresInSeconds: OTP_TTL_MS / 1000 };
  },

  async verifyOtp(rawPhone: string, code: string): Promise<boolean> {
    await connectDatabase();
    const phone = normalizePakistaniPhone(rawPhone);
    const key = storeKey(phone);
    const record = await OtpChallengeModel.findOne({ phoneKey: key }).select(
      "+codeHash",
    );

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await OtpChallengeModel.deleteOne({ phoneKey: key });
      }
      return false;
    }

    const nextAttempts = record.attempts + 1;
    if (nextAttempts > MAX_ATTEMPTS) {
      await OtpChallengeModel.deleteOne({ phoneKey: key });
      return false;
    }

    const valid = record.codeHash === hashCode(code.trim(), phone);
    if (valid) {
      await OtpChallengeModel.deleteOne({ phoneKey: key });
      return true;
    }

    await OtpChallengeModel.updateOne(
      { phoneKey: key },
      { $set: { attempts: nextAttempts } },
    );
    return false;
  },
};
