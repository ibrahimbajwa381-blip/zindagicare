import { withApiHandler } from "@/server/api/with-api-handler";
import { listPhysiotherapistsForAdmin } from "@/server/services/physiotherapist.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const status = searchParams.get("status") ?? undefined;
    const physiotherapists = await listPhysiotherapistsForAdmin(status);
    return { physiotherapists };
  },
  { auth: true, roles: ["admin", "super_admin"] },
);
