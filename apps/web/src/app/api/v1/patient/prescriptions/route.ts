import { withApiHandler } from "@/server/api/with-api-handler";
import { PrescriptionService } from "@/server/services/prescription.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return PrescriptionService.listForPatient(session!.user!.id);
  },
  { auth: true, roles: ["patient"] },
);
