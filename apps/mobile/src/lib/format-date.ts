/** Server always returns UTC ISO strings; consult slots are defined in Asia/Karachi, so
 * format against that zone rather than the device's local timezone. */
export function formatKarachi(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Date-only, e.g. "5 Jan 2026" — Asia/Karachi, same rationale as {@link formatKarachi}. */
export function formatKarachiDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
  });
}

/** Time-only, e.g. "2:30 PM" — Asia/Karachi, same rationale as {@link formatKarachi}. */
export function formatKarachiTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time, e.g. "5m ago" / "3d ago", for chat thread previews. */
export function timeAgo(iso?: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
