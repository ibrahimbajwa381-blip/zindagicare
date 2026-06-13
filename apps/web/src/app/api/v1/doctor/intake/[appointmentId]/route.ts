import { withApiHandler } from "@/server/api/with-api-handler";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { appointmentId } = await params;

  const handler = withApiHandler(
    async ({ session }) => {
      return MedicalIntakeService.getForDoctor(
        appointmentId,
        session!.user!.id,
      );
    },
    { auth: true, roles: ["doctor"] },
  );

  return handler(req as never);
}
