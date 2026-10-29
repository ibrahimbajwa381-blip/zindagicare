/** Strip spaces, dashes, and other non-digits from a phone input. */
export function digitsOnlyPhone(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Normalize common Pakistani phone inputs to digits-only for validation.
 * Handles +92, 0092, spaces, dashes, and leading zeros.
 */
export function normalizePhoneDigits(raw: string): string {
  let digits = digitsOnlyPhone(raw.trim());

  if (digits.startsWith("0092")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("92") && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith("03") && digits.length >= 11) {
    return digits.slice(0, 11);
  }

  if (digits.startsWith("3") && digits.length >= 10) {
    return digits.slice(0, 10);
  }

  return digits;
}

/** Pakistani mobile: 03XXXXXXXXX, 3XXXXXXXXX, or 923XXXXXXXXX (digits only). */
export function isValidPakistaniMobile(digits: string): boolean {
  if (digits.startsWith("92") && digits.length === 12 && digits[2] === "3") {
    return true;
  }
  if (digits.startsWith("03") && digits.length === 11) {
    return true;
  }
  if (digits.startsWith("3") && digits.length === 10) {
    return true;
  }
  return false;
}

/** Local display/storage form: 03XXXXXXXXX (11 digits). */
export function toPakistaniLocalPhone(digits: string): string {
  if (digits.startsWith("92") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("3") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export function parsePakistaniLocalPhone(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (!isValidPakistaniMobile(digits)) return null;
  return toPakistaniLocalPhone(digits);
}

/**
 * Pakistani mobile → 03XXXXXXXXX; any other country, written with a leading + or 00
 * and its country code → E.164 (+447911123456). Returns null when neither fits.
 */
export function parsePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = digitsOnlyPhone(trimmed);
  const hasCountryPrefix = trimmed.startsWith("+") || digits.startsWith("00");
  const international = digits.startsWith("00") ? digits.slice(2) : digits;

  // Checked before the Pakistani heuristics, which would misread e.g. +33 6… as 03….
  if (hasCountryPrefix && !international.startsWith("92")) {
    return /^[1-9]\d{7,14}$/.test(international) ? `+${international}` : null;
  }
  return parsePakistaniLocalPhone(trimmed);
}

export const PAKISTANI_PHONE_HINT =
  "Start with 03 — for example 03001234567 (11 digits)";

export const PAKISTANI_PHONE_ERROR =
  "Enter a valid Pakistani mobile number (11 digits, starting with 03)";

export const PHONE_ERROR =
  "Enter a valid mobile number — 03XXXXXXXXX, or your country code for international (e.g. +44…)";
