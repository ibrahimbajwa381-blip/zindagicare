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
