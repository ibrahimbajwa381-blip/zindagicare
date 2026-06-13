import {
  updateIntakeQuestionsSchema,
  type UpdateIntakeQuestionsInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return MedicalIntakeService.getDoctorQuestions(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);

export const PUT = withApiHandler<UpdateIntakeQuestionsInput>(
  async ({ session, body }) => {
    return MedicalIntakeService.updateDoctorQuestions(
      session!.user.id,
      body.questions,
    );
  },
  { auth: true, roles: ["doctor"], bodySchema: updateIntakeQuestionsSchema },
);
