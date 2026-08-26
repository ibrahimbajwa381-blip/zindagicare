import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getHerbalistProfile,
  updateHerbalistProfile,
} from "@/server/services/herbalist-profile.service";
import { updateHerbalistProfileSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => getHerbalistProfile(session!.user.id),
  { auth: true, roles: ["herbalist"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => updateHerbalistProfile(session!.user.id, body),
  {
    auth: true,
    roles: ["herbalist"],
    bodySchema: updateHerbalistProfileSchema,
  },
);
