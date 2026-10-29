export type FinishConsultOutcome = "completed" | "no_show";

/** Provider ends an online consult (any type). Returns an error message, or null on success. */
export async function finishConsult(
  appointmentId: string,
  outcome: FinishConsultOutcome = "completed",
): Promise<string | null> {
  const res = await fetch(`/api/v1/appointments/${appointmentId}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome }),
  }).catch(() => null);
  if (res?.ok) return null;
  const json = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
  return json?.error?.message ?? "Could not update this consultation. Please try again.";
}
