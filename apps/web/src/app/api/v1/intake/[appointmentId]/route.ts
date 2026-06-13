import {
  submitIntakeFormSchema,
  type SubmitIntakeFormInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
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
      return MedicalIntakeService.submitForm(
        appointmentId,
        session!.user!.id,
        body.answers,
      );
    },
    { auth: true, bodySchema: submitIntakeFormSchema },
  );

  return handler(req as never);
}
