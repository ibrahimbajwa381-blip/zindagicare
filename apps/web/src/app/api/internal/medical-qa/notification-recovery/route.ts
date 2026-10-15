import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sweepMissedAnswerNotifications } from "@/server/services/medical-qa-answer-notify.service";
import { MedicalQaAlerts } from "@/server/services/medical-qa-alerts.service";

/**
 * Scheduled recovery for Medical Q&A notifications (intended: every 5 minutes).
 * Without it, missed notifications are only retried when someone posts.
 *
 *  - Answer notifications the patient never received (crashed/failed runs).
 *  - New-question alerts to professionals that failed or got stuck.
 *
 * Both reuse the same sweeps as the request-time catch-up, so the window,
 * eligibility rules (hidden/deleted questions, own question, inactive author)
 * and de-duplication are identical. Each run is bounded, and running it twice
 * or concurrently is safe: notifications are keyed by answer id and alert runs
 * are claimed atomically.
 */
const RECOVERY_BATCH = { answerNotifications: 50, questionAlerts: 20 } as const;

function secretMatches(given: string | null, secret: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; external schedulers may send `x-cron-secret`. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Same convention as the other /api/internal jobs: open only in local development.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  return secretMatches(bearer, secret) || secretMatches(req.headers.get("x-cron-secret"), secret);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Independent: one failing must not stop the other. Errors carry no medical text.
  const [answers, alerts] = await Promise.allSettled([
    sweepMissedAnswerNotifications({ limit: RECOVERY_BATCH.answerNotifications }),
    MedicalQaAlerts.sweepPending({ limit: RECOVERY_BATCH.questionAlerts }),
  ]);
  const result = {
    answerNotificationsDelivered: answers.status === "fulfilled" ? answers.value : null,
    questionAlertRunsRetried: alerts.status === "fulfilled" ? alerts.value : null,
  };
  for (const [name, r] of [["answers", answers], ["alerts", alerts]] as const) {
    if (r.status === "rejected") {
      console.error("[medical-qa-recovery] sweep failed", { sweep: name, error: (r.reason as Error)?.name });
    }
  }
  const failed = answers.status === "rejected" || alerts.status === "rejected";
  // 500 on failure so the scheduler records it; the next run simply tries again.
  return NextResponse.json({ success: !failed, results: result }, { status: failed ? 500 : 200 });
}

// Vercel Cron triggers with GET.
export async function GET(req: NextRequest) {
  return POST(req);
}
