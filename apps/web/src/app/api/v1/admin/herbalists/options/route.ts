import { withApiHandler } from "@/server/api/with-api-handler";
import {
  HERBALIST_SPECIALTIES_ALPHABETICAL,
  MAX_HERBALIST_SPECIALTIES,
} from "@zindagi/shared";

/** Static option lists for the admin herbalist create/edit forms. */
export const GET = withApiHandler(
  async () => ({
    specialties: HERBALIST_SPECIALTIES_ALPHABETICAL,
    maxSpecialties: MAX_HERBALIST_SPECIALTIES,
  }),
  { auth: true, roles: ["admin", "super_admin"] },
);
