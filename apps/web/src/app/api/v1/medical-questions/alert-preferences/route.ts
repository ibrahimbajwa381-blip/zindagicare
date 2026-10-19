import { medicalQaAlertPreferenceSchema, MEDICAL_QA_LIMITS } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { rateLimitMedicalQa } from "@/server/api/medical-qa-route";
import { medicalQaLimiters } from "@/server/services/medical-qa.service";
import { MedicalQaAlerts } from "@/server/services/medical-qa-alerts.service";

/** The signed-in user's own new-question alert setting. There is no user id parameter by design. */
export const GET = withApiHandler(
  async ({ session }) => MedicalQaAlerts.preferenceView(session!.user.id),
  { auth: true },
);

export const PUT = withApiHandler(
  async ({ req, session }) => {
    await rateLimitMedicalQa(medicalQaLimiters.alertPreference, req, session);
    const input = await readJsonBody(req, medicalQaAlertPreferenceSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    await MedicalQaAlerts.setPreference(session!.user.id, input.questionAlerts);
    return MedicalQaAlerts.preferenceView(session!.user.id);
  },
  { auth: true },
);
