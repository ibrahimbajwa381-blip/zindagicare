import { withApiHandler } from "@/server/api/with-api-handler";
import { deleteOwnAccount } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ session }) => {
    await deleteOwnAccount(session!.user.id);
    return { deleted: true };
  },
  { auth: true },
);
