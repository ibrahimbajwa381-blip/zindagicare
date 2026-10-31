import { withApiHandler } from "@/server/api/with-api-handler";
import { searchBookablePatients } from "@/server/services/admin-patient.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? "";
    const patients = await searchBookablePatients(search);
    return { patients };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
