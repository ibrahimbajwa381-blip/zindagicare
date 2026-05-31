import { withApiHandler } from "@/server/api/with-api-handler";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getDoctorProfile(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);
