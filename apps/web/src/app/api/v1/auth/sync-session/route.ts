import { withApiHandler } from "@/server/api/with-api-handler";
import { syncSessionRoles } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ session }) => {
    const payload = await syncSessionRoles(session!.user.id);
    return { user: payload };
  },
  { auth: true },
);
