import { withApiHandler } from "@/server/api/with-api-handler";
import {
  adminCreatePhysiotherapist,
  listPhysiotherapistsForManagement,
} from "@/server/services/admin-physiotherapist.service";
import { Roles } from "@zindagi/shared";
import { adminCreatePhysiotherapistSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const physiotherapists = await listPhysiotherapistsForManagement(search);
    return { physiotherapists };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const physiotherapist = await adminCreatePhysiotherapist(session!.user!.id, body);
    return { physiotherapist };
  },
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminCreatePhysiotherapistSchema,
  },
);
