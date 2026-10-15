import { after } from "next/server";
import {
  notifyQuestionAnswered,
  sweepMissedAnswerNotifications,
} from "@/server/services/medical-qa-answer-notify.service";

/**
 * Notifies the question's author after the response is sent, so posting an
 * answer never waits on push providers. Failures are contained here: they
 * can never turn a saved answer into an error response.
 */
export function scheduleAnswerNotification(answerId: string) {
  const run = async () => {
    try {
      await notifyQuestionAnswered(answerId);
    } catch (e) {
      console.error("[medical-qa-answer-notify] background run failed", { answerId, error: (e as Error)?.name });
    }
    // Picks up earlier notifications that never landed (there is no queue/cron for this).
    try {
      await sweepMissedAnswerNotifications();
    } catch (e) {
      console.error("[medical-qa-answer-notify] catch-up sweep failed", { error: (e as Error)?.name });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts): run detached instead.
    void run();
  }
}
