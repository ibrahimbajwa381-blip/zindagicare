import { withApiHandler } from "@/server/api/with-api-handler";
import { adminCreateHerbalist } from "@/server/services/admin-herbalist.service";
import { adminCreateHerbalistSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ body }) => adminCreateHerbalist(body),
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: adminCreateHerbalistSchema,
  },
);
