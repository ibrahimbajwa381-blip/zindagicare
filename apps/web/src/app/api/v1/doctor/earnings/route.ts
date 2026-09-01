import { withApiHandler } from "@/server/api/with-api-handler";
import { getDoctorEarnings } from "@/server/services/doctor-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getDoctorEarnings(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);
