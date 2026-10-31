import { withApiHandler } from "@/server/api/with-api-handler";
import { listPhysiotherapistsForAdmin } from "@/server/services/physiotherapist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const status = searchParams.get("status") ?? undefined;
    const physiotherapists = await listPhysiotherapistsForAdmin(status);
    return { physiotherapists };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
