import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getNurseProfile,
  updateNursePortfolio,
} from "@/server/services/nurse.service";
import { updateNursePortfolioSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    const profile = await getNurseProfile(session!.user.id);
    return profile.portfolio;
  },
  { auth: true, roles: ["nurse"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updateNursePortfolio(session!.user.id, body);
  },
  { auth: true, roles: ["nurse"], bodySchema: updateNursePortfolioSchema },
);
