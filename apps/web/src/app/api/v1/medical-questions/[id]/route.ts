import { withApiHandler } from "@/server/api/with-api-handler";
import { medicalQaPathIds, rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

/** Public question + answers. Private photo URLs are included only for authorized viewers. */
export const GET = withApiHandler(async ({ req, session }) => {
  await rateLimitMedicalQa(medicalQaLimiters.publicRead, req, session);
  const [questionId] = medicalQaPathIds(req.url);
  return MedicalQaService.getQuestion(viewerFrom(session), questionId ?? "");
});

export const DELETE = withApiHandler(
  async ({ req, session }) => {
    const [questionId] = medicalQaPathIds(req.url);
    return MedicalQaService.deleteQuestion(viewerFrom(session)!, questionId ?? "");
  },
  { auth: true },
);
