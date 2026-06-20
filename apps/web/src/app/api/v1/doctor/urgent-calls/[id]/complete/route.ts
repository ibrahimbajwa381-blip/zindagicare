import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async ({ session }) =>
      UrgentConsultService.completeDoctorUrgentCall(session!.user!.id, id),
    { auth: true, roles: [Roles.DOCTOR] },
  );
  return handler(_req as import("next/server").NextRequest);
}
