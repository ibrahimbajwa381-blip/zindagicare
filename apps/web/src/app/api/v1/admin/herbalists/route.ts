import { withApiHandler } from "@/server/api/with-api-handler";
import { listAllHerbalists } from "@/server/services/admin-herbalist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => ({
    herbalists: await listAllHerbalists(
      searchParams.get("search") ?? undefined,
      searchParams.get("status") ?? undefined,
    ),
  }),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
