import { withApiHandler } from "@/server/api/with-api-handler";
import { getDoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getDoctorDashboardSummary(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);
