import { after } from "next/server";
import { publishMedicalQaEvent, type MedicalQaRealtimeEvent } from "@/lib/realtime/medical-qa-emitter";

/**
 * Realtime is best-effort and strictly after the DB write; failures never
 * affect the response. Publishing is a Redis round trip, so it runs through
 * `after` (Vercel `waitUntil`): an un-awaited promise can be frozen with the
 * function once the response is sent, silently dropping the event.
 */
export function scheduleMedicalQaPublish(event: MedicalQaRealtimeEvent) {
  const run = () => {
    try {
      return Promise.resolve(publishMedicalQaEvent(event)).then(
        () => {},
        () => {},
      );
    } catch {
      // Subscribers re-fetch through the API, so a dropped event is harmless.
      return Promise.resolve();
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): run detached instead.
    void run();
  }
}
