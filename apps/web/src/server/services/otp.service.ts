import { createHash, randomInt } from "crypto";
import { normalizePakistaniPhone } from "@/lib/auth/phone";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type OtpRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

/** In-process store for local dev when Redis is not configured. */
const memoryStore = new Map<string, OtpRecord>();

function hashCode(code: string, phone: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function storeKey(phone: string) {
  return `otp:${phone}`;
}

/**
 * Phone OTP architecture:
 * 1. Client POST /api/v1/auth/otp/request → SMS gateway (SMS_API_KEY) sends code.
 * 2. Client POST /api/v1/auth/otp/verify OR signIn("phone-otp") with phone + code.
 * 3. Production: replace memoryStore with Upstash Redis (UPSTASH_REDIS_*).
 */
export const otpService = {
  async requestOtp(rawPhone: string): Promise<{ expiresInSeconds: number }> {
    const phone = normalizePakistaniPhone(rawPhone);
    const code = String(randomInt(100000, 999999));
    const record: OtpRecord = {
      codeHash: hashCode(code, phone),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    };

    memoryStore.set(storeKey(phone), record);

    if (process.env.SMS_API_KEY) {
      // await smsGateway.send(phone, `Your ZindagiCare code is ${code}`);
    } else if (process.env.NODE_ENV !== "production") {
      console.info(`[dev-otp] ${phone} → ${code}`);
    }

    return { expiresInSeconds: OTP_TTL_MS / 1000 };
  },

  async verifyOtp(rawPhone: string, code: string): Promise<boolean> {
    const phone = normalizePakistaniPhone(rawPhone);
    const key = storeKey(phone);
    const record = memoryStore.get(key);

    if (!record || record.expiresAt < Date.now()) {
      memoryStore.delete(key);
      return false;
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      memoryStore.delete(key);
      return false;
    }

    const valid = record.codeHash === hashCode(code, phone);
    if (valid) {
      memoryStore.delete(key);
    }
    return valid;
  },
};
