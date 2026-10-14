import { MEDICAL_QA_LIMITS, reportMedicalQaSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { medicalQaPathIds, rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

export const POST = withApiHandler(
  async ({ req, session }) => {
    await rateLimitMedicalQa(medicalQaLimiters.report, req, session);
    const [questionId] = medicalQaPathIds(req.url);
    const input = await readJsonBody(req, reportMedicalQaSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    return MedicalQaService.report(viewerFrom(session)!, questionId ?? "", input);
  },
  { auth: true },
);
