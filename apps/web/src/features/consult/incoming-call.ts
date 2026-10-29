/** Service-worker → page message for a ring push; sw.ts keeps its own copy of this string. */
export const INCOMING_CALL_MESSAGE = "zindagi:incoming-call";

export type IncomingCallRing = {
  ringId: string;
  appointmentId: string;
  fromName: string;
  fromRole: "patient" | "doctor";
  fromAvatarUrl: string | null;
  startedAt: string;
};

export type CallRingStatus = "ringing" | "answered" | "declined" | "cancelled" | "missed";

export function postCallRingAction(
  appointmentId: string,
  body:
    | { action: "ring"; ringId?: string }
    | { action: "cancel" | "decline"; ringId: string }
    | { action: "answer" },
  init?: { keepalive?: boolean },
) {
  return fetch(`/api/v1/video/sessions/${appointmentId}/ring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: init?.keepalive,
  });
}
