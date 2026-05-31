import { parsePakistaniLocalPhone } from "@zindagi/validators";

/** Normalize Pakistani mobile to E.164 (+923xxxxxxxxx). */
export function normalizePakistaniPhone(input: string): string {
  const local = parsePakistaniLocalPhone(input);
  if (!local) {
    throw new Error("Invalid Pakistani phone number");
  }
  return `+92${local.slice(1)}`;
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "****";
  return `${e164.slice(0, 4)}****${e164.slice(-2)}`;
}
