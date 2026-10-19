import { after } from "next/server";
import { MedicalQaAlerts } from "@/server/services/medical-qa-alerts.service";

/** Due retries picked up alongside each new question (there is no queue/cron for this yet). */
const OPPORTUNISTIC_SWEEP_LIMIT = 5;

/**
 * Runs new-question alerts after the response is sent, so posting a
 * question never waits on push providers. Failures are contained here:
 * they can never turn a saved question into an error response.
 */
export function scheduleQuestionAlerts(questionId: string, opts: { maxAgeMs?: number } = {}) {
  const run = async () => {
    try {
      await MedicalQaAlerts.processQuestion(questionId, opts);
      await MedicalQaAlerts.sweepPending({ limit: OPPORTUNISTIC_SWEEP_LIMIT });
    } catch (e) {
      console.error("[medical-qa-alerts] background run failed", { questionId, error: (e as Error)?.name });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts): run detached instead.
    void run();
  }
}
