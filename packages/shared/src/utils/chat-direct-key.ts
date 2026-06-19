/** Stable key for one ongoing chat thread per doctor–patient pair. */
export function buildChatDirectKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}
