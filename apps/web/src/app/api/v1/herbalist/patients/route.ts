import { withApiHandler } from "@/server/api/with-api-handler";
import { listHerbalistPatients } from "@/server/services/herbalist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => ({
    patients: await listHerbalistPatients(session!.user.id),
  }),
  { auth: true, roles: ["herbalist"] },
);
