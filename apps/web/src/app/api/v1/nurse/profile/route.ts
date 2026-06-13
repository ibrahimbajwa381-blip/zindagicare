import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getNurseProfile,
  updateNurseProfile,
} from "@/server/services/nurse.service";
import { updateNurseProfileSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    return getNurseProfile(session!.user.id);
  },
  { auth: true, roles: ["nurse"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updateNurseProfile(session!.user.id, body);
  },
  { auth: true, roles: ["nurse"], bodySchema: updateNurseProfileSchema },
);
