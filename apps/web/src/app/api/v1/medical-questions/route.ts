import {
  createMedicalQuestionSchema,
  listMedicalQuestionsQuerySchema,
  MEDICAL_QA_LIMITS,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { scheduleQuestionAlerts } from "@/server/lib/schedule-question-alerts";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

/** Public list of questions (newest first, cursor-paginated). */
export const GET = withApiHandler(async ({ req, session, searchParams }) => {
  await rateLimitMedicalQa(medicalQaLimiters.publicRead, req, session);
  const query = listMedicalQuestionsQuerySchema.parse(Object.fromEntries(searchParams));
  return MedicalQaService.listQuestions(viewerFrom(session), query);
});

/** Any signed-in account can ask; the author is always the session user. Verified professionals are alerted afterwards. */
export const POST = withApiHandler(
  async ({ req, session }) => {
    await rateLimitMedicalQa(
      medicalQaLimiters.createQuestion,
      req,
      session,
      "You've asked several questions recently. Please wait a while before asking another.",
    );
    const input = await readJsonBody(req, createMedicalQuestionSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    const question = await MedicalQaService.createQuestion(viewerFrom(session)!, input);
    // Only after a successful save. Replays of the same idempotency key are
    // harmless: alert processing is idempotent per question.
    scheduleQuestionAlerts(question.id);
    return question;
  },
  { auth: true },
);
