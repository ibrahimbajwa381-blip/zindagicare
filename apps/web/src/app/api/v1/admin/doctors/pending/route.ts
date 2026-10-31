import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingDoctorVerifications } from "@/server/services/doctor-verification.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => {
    const pending = await listPendingDoctorVerifications();
    return { doctors: pending };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
