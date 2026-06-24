import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getPhysiotherapistProfile,
  updatePhysiotherapistProfile,
} from "@/server/services/physiotherapist.service";
import { updatePhysiotherapistProfileSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    return getPhysiotherapistProfile(session!.user.id);
  },
  { auth: true, roles: ["physiotherapist"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updatePhysiotherapistProfile(session!.user.id, body);
  },
  { auth: true, roles: ["physiotherapist"], bodySchema: updatePhysiotherapistProfileSchema },
);
