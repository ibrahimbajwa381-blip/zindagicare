import { withApiHandler } from "@/server/api/with-api-handler";
import { listNursesForAdmin } from "@/server/services/nurse.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const status = searchParams.get("status") ?? undefined;
    const nurses = await listNursesForAdmin(status);
    return { nurses };
  },
  { auth: true, roles: ["admin", "super_admin"] },
);
