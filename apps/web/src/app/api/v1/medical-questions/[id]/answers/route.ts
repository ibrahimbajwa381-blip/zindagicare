import { createMedicalAnswerSchema, MEDICAL_QA_LIMITS } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { medicalQaPathIds, rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

/**
 * Verified providers post answers; the question's author posts follow-ups.
 * Eligibility is decided server-side from DoctorProfile/StaffProfile records.
 */
export const POST = withApiHandler(
  async ({ req, session }) => {
    await rateLimitMedicalQa(medicalQaLimiters.createAnswer, req, session);
    const [questionId] = medicalQaPathIds(req.url);
    const input = await readJsonBody(req, createMedicalAnswerSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    return MedicalQaService.createAnswer(viewerFrom(session)!, questionId ?? "", input);
  },
  { auth: true },
);
