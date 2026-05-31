import { withApiHandler } from "@/server/api/with-api-handler";
import { listPatients } from "@/server/services/admin-patient.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const patients = await listPatients(search);
    return { patients };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
