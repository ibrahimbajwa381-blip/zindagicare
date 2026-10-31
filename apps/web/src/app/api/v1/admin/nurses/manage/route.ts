import { withApiHandler } from "@/server/api/with-api-handler";
import {
  adminCreateNurse,
  listNursesForManagement,
} from "@/server/services/admin-nurse.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminCreateNurseSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const nurses = await listNursesForManagement(search);
    return { nurses };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const nurse = await adminCreateNurse(session!.user!.id, body);
    return { nurse };
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminCreateNurseSchema,
  },
);
