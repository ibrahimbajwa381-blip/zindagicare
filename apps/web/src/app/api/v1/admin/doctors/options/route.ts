import { withApiHandler } from "@/server/api/with-api-handler";
import { listDoctorsForReassign } from "@/server/services/admin-doctor.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => {
    const doctors = await listDoctorsForReassign();
    return { doctors };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
