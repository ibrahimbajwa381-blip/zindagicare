import { withApiHandler } from "@/server/api/with-api-handler";
import {
  grantAdminAccess,
  listAdmins,
} from "@/server/services/admin-users.service";
import { Roles } from "@zindagi/shared";
import { adminGrantSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const admins = await listAdmins(search);
    return { admins };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const admin = await grantAdminAccess(session!.user.id, body);
    return { admin };
  },
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminGrantSchema,
  },
);
