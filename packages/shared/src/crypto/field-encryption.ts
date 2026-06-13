import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:v1:";
const FILE_MAGIC = Buffer.from("ZCF1");

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is required — generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes when base64-decoded");
  }

  cachedKey = key;
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return `${ENCRYPTED_PREFIX}${payload.toString("base64url")}`;
}

export function decryptField(value: string): string {
  if (!value || !isEncrypted(value)) return value;

  const key = resolveKey();
  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64url");
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

/** HMAC-SHA256 for searchable lookups (email, phone) without storing plaintext. */
export function hashLookup(normalized: string): string {
  const key = resolveKey();
  return createHmac("sha256", key).update(normalized).digest("hex");
}

export function normalizeEmailForLookup(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalize Pakistani phone to E.164 (+92…) for consistent lookup hashes. */
export function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone.trim();
  if (digits.startsWith("92") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.length === 10) return `+92${digits}`;
  return `+${digits}`;
}

export function encryptBuffer(data: Buffer): Buffer {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(data: Buffer): Buffer {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = resolveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function wrapEncryptedFile(data: Buffer): Buffer {
  return Buffer.concat([FILE_MAGIC, encryptBuffer(data)]);
}

export function unwrapEncryptedFile(data: Buffer): Buffer {
  if (data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    return decryptBuffer(data.subarray(FILE_MAGIC.length));
  }
  return data;
}

export function isEncryptedFile(data: Buffer): boolean {
  return data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
}

export function phoneLookupHash(phone: string): string {
  return hashLookup(normalizePhoneForLookup(phone));
}

export function emailLookupHash(email: string): string {
  return hashLookup(normalizeEmailForLookup(email));
}
