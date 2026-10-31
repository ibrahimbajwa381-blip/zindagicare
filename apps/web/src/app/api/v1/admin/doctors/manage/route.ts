import { withApiHandler } from "@/server/api/with-api-handler";
import {
  adminCreateDoctor,
  listAllDoctors,
} from "@/server/services/admin-doctor.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminCreateDoctorSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const doctors = await listAllDoctors(search);
    return { doctors };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const doctor = await adminCreateDoctor(session!.user!.id, body);
    return { doctor };
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminCreateDoctorSchema,
  },
);
