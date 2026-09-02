import { withApiHandler } from "@/server/api/with-api-handler";
import {
  NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
  MAX_NUTRITIONIST_SPECIALTIES,
} from "@zindagi/shared";

/** Static option lists for the admin nutritionist create/edit forms. */
export const GET = withApiHandler(
  async () => ({
    specialties: NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
    maxSpecialties: MAX_NUTRITIONIST_SPECIALTIES,
  }),
  { auth: true, roles: ["admin", "super_admin"] },
);
