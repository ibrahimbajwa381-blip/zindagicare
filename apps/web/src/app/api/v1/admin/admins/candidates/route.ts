import { withApiHandler } from "@/server/api/with-api-handler";
import { searchAdminGrantCandidates } from "@/server/services/admin-users.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? "";
    const candidates = await searchAdminGrantCandidates(search);
    return { candidates };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
