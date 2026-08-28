import { withApiHandler } from "@/server/api/with-api-handler";

export const GET = withApiHandler(
  async ({ session }) => ({ user: session!.user }),
  { auth: true },
);
