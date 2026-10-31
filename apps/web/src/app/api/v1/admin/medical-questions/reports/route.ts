import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { MEDICAL_QA_LIMITS, moderateMedicalQaReportSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { viewerFrom } from "@/server/api/medical-qa-route";
import { scheduleQuestionAlerts } from "@/server/lib/schedule-question-alerts";
import { QUESTION_ALERT_CONFIG } from "@/server/lib/medical-qa-alert-rules";
import { MedicalQaService } from "@/server/services/medical-qa.service";

const ADMIN_ROLES = ADMIN_PANEL_ROLES;

/** Open reports on public Q&A content. */
export const GET = withApiHandler(async () => MedicalQaService.listReports(), {
  auth: true,
  roles: ADMIN_ROLES,
});

/** Hide / restore / dismiss — every action is written to the audit log. */
export const PATCH = withApiHandler(
  async ({ req, session }) => {
    const input = await readJsonBody(req, moderateMedicalQaReportSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    const { restoredQuestionId, ...result } = await MedicalQaService.moderate(viewerFrom(session)!, input);
    // Alerts skip hidden questions, so one hidden before its alerts ran gets them on restore,
    // but only while still fresh (see restoreAlertMaxAgeMs). Safe to schedule on every
    // restore, repeated or concurrent: processing is claimed atomically and a no-op once done.
    if (restoredQuestionId) {
      scheduleQuestionAlerts(restoredQuestionId, { maxAgeMs: QUESTION_ALERT_CONFIG.restoreAlertMaxAgeMs });
    }
    return result;
  },
  { auth: true, roles: ADMIN_ROLES },
);
