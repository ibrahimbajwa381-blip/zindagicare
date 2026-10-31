import { withApiHandler } from "@/server/api/with-api-handler";
import {
  adminCreatePhysiotherapist,
  listPhysiotherapistsForManagement,
} from "@/server/services/admin-physiotherapist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminCreatePhysiotherapistSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const physiotherapists = await listPhysiotherapistsForManagement(search);
    return { physiotherapists };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    const physiotherapist = await adminCreatePhysiotherapist(session!.user!.id, body);
    return { physiotherapist };
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminCreatePhysiotherapistSchema,
  },
);
