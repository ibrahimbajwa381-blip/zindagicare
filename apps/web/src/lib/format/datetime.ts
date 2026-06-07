const KARACHI_TZ = "Asia/Karachi";

export function formatKarachiTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KARACHI_TZ,
    hour12: true,
  });
}

export function formatKarachiDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: KARACHI_TZ,
  });
}

export function formatKarachiDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: KARACHI_TZ,
  });
}
