import { withApiHandler } from "@/server/api/with-api-handler";
import { listDoctorsForReassign } from "@/server/services/admin-doctor.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => {
    const doctors = await listDoctorsForReassign();
    return { doctors };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
