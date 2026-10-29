import { parsePhoneNumber } from "@zindagi/validators";

/** Normalize a Pakistani (+923xxxxxxxxx) or international mobile to E.164. */
export function normalizePhone(input: string): string {
  const parsed = parsePhoneNumber(input);
  if (!parsed) {
    throw new Error("Invalid phone number");
  }
  return parsed.startsWith("+") ? parsed : `+92${parsed.slice(1)}`;
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "****";
  return `${e164.slice(0, 4)}****${e164.slice(-2)}`;
}
