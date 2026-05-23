import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingDoctorVerifications } from "@/server/services/doctor-verification.service";

export const GET = withApiHandler(
  async () => {
    const pending = await listPendingDoctorVerifications();
    return { doctors: pending };
  },
  { auth: true, roles: ["admin", "super_admin"] },
);
