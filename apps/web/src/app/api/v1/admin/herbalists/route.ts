import { withApiHandler } from "@/server/api/with-api-handler";
import { listAllHerbalists } from "@/server/services/admin-herbalist.service";

export const GET = withApiHandler(
  async ({ searchParams }) => ({
    herbalists: await listAllHerbalists(
      searchParams.get("search") ?? undefined,
      searchParams.get("status") ?? undefined,
    ),
  }),
  { auth: true, roles: ["admin", "super_admin"] },
);
