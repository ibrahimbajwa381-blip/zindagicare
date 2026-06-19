import {
  submitIntakeFormSchema,
  type SubmitIntakeFormInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { appointmentId } = await params;

  const handler = withApiHandler(
    async ({ session }) => {
      return MedicalIntakeService.getForPatient(
        appointmentId,
        session!.user!.id,
      );
    },
    { auth: true },
  );

  return handler(req as never);
}

export async function POST(req: Request, { params }: Params) {
  const { appointmentId } = await params;

  const handler = withApiHandler<SubmitIntakeFormInput>(
    async ({ session, body }) => {
      const intake = await MedicalIntakeService.submitForm(
        appointmentId,
        session!.user!.id,
        body.answers,
      );
      await ChatService.sendIntakeFormThankYou(appointmentId);
      return intake;
    },
    { auth: true, bodySchema: submitIntakeFormSchema },
  );

  return handler(req as never);
}
