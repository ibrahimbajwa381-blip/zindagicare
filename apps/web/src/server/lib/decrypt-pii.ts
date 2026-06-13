import { decryptField, isEncrypted } from "@zindagi/shared/crypto/field-encryption";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";

/** Decrypt a single PII field when populate/lean skipped mongoose hooks. */
export function revealPii(value?: string | null): string | undefined {
  if (!value) return undefined;
  return isEncrypted(value) ? decryptField(value) : value;
}

/** Never surface ciphertext in UI — returns undefined if still encrypted after reveal. */
export function safeDisplayText(value?: string | null): string | undefined {
  const revealed = revealPii(value);
  if (!revealed || isEncrypted(revealed)) return undefined;
  return revealed;
}

export function formatPhoneForDisplay(phone?: string | null): string | undefined {
  const revealed = safeDisplayText(phone);
  if (!revealed) return undefined;
  const digits = normalizePhoneDigits(revealed);
  if (!digits) return undefined;
  return toPakistaniLocalPhone(digits);
}

export function mapUserPii(user: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return {
    name: safeDisplayText(user.name) ?? "Doctor",
    email: safeDisplayText(user.email),
    phone: formatPhoneForDisplay(user.phone),
  };
}
