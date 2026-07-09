import { createHash, randomInt } from "crypto";
import { connectDatabase, OtpChallengeModel } from "@zindagi/database";
import { AppError } from "@zindagi/shared";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { findActiveUserByPhone } from "@/server/services/auth.service";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 30 * 1000;

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function storeKey(phone: string) {
  return `otp:${phone}`;
}

/**
 * Phone OTP architecture:
 * 1. Client POST /api/v1/auth/otp/request → SMS gateway (SMS_API_KEY) sends code.
 * 2. Client submits code via signIn("phone-otp") with phone + code.
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
      throw new AppError(
        "Please wait before requesting another code",
        "RATE_LIMITED",
        429,
      );
    }

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
