import { withApiHandler } from "@/server/api/with-api-handler";
import { listDoctorConsultRequests } from "@/server/services/doctor-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return listDoctorConsultRequests(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);
