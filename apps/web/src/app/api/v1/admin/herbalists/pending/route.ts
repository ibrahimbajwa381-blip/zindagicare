import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingHerbalistVerifications } from "@/server/services/herbalist-verification.service";

export const GET = withApiHandler(
  async () => ({ applications: await listPendingHerbalistVerifications() }),
  { auth: true, roles: ["admin", "super_admin"] },
);
