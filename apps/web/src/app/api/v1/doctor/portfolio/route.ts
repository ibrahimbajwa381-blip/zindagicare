import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getDoctorProfile,
  updateDoctorPortfolio,
} from "@/server/services/doctor-profile.service";
import { updateDoctorPortfolioSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    const profile = await getDoctorProfile(session!.user.id);
    return profile.portfolio;
  },
  { auth: true, roles: ["doctor"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updateDoctorPortfolio(session!.user.id, body);
  },
  { auth: true, roles: ["doctor"], bodySchema: updateDoctorPortfolioSchema },
);
