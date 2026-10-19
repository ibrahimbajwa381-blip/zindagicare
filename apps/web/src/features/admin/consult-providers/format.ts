const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatDayOfWeek(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function formatCurrency(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { dateStyle: "medium" });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });
}

export function formatCnicLast4(last4?: string): string {
  return last4 ? `•••••-•••••${last4}` : "—";
}

/** wa.me wants international digits only: 0300… → 92300… */
export function whatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
}

export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Primary first, then additional — the specialties the provider applied for. */
export function claimedSpecialties(provider: {
  primarySpecialty?: string;
  additionalSpecialties: string[];
}): string[] {
  return [
    ...new Set(
      [provider.primarySpecialty, ...provider.additionalSpecialties].filter(
        (s): s is string => Boolean(s?.trim()),
      ),
    ),
  ];
}

/** Split a comma-separated input into trimmed, non-empty values. */
export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
