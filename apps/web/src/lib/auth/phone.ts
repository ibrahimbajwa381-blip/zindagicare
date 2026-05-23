/** Normalize Pakistani mobile to E.164 (+923xxxxxxxxx). */
export function normalizePakistaniPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("03") && digits.length === 11) {
    return `+92${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("3")) {
    return `+92${digits}`;
  }
  throw new Error("Invalid Pakistani phone number");
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "****";
  return `${e164.slice(0, 4)}****${e164.slice(-2)}`;
}
