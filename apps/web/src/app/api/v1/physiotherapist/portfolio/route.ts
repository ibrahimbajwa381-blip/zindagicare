import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getPhysiotherapistProfile,
  updatePhysiotherapistPortfolio,
} from "@/server/services/physiotherapist.service";
import { updatePhysiotherapistPortfolioSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    const profile = await getPhysiotherapistProfile(session!.user.id);
    return profile.portfolio;
  },
  { auth: true, roles: ["physiotherapist"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updatePhysiotherapistPortfolio(session!.user.id, body);
  },
  { auth: true, roles: ["physiotherapist"], bodySchema: updatePhysiotherapistPortfolioSchema },
);
