import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

export const GET = withApiHandler(
  async ({ session }) => UrgentConsultService.getPatientRequest(session!.user!.id),
  { auth: true },
);
