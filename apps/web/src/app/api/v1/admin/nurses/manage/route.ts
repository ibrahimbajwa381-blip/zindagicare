import { withApiHandler } from "@/server/api/with-api-handler";
import {
  adminCreateNurse,
  listNursesForManagement,
} from "@/server/services/admin-nurse.service";
import { Roles } from "@zindagi/shared";
import { adminCreateNurseSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const nurses = await listNursesForManagement(search);
    return { nurses };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const nurse = await adminCreateNurse(session!.user!.id, body);
    return { nurse };
  },
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminCreateNurseSchema,
  },
);
