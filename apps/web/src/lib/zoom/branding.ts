/** Display title for all video consult rooms (Zoom meeting topic + in-app header). */
export const ZOOM_CONSULT_MEETING_TITLE = "ZindagiCare — Patient & Doctor consultation";

export const ZOOM_CONSULT_MEETING_SUBTITLE = "Secure video consultation on ZindagiCare";

export function formatConsultParticipantLine(
  role: "patient" | "doctor",
  counterpartName: string,
) {
  return role === "doctor" ? `Patient: ${counterpartName}` : `Doctor: ${counterpartName}`;
}
