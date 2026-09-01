import { withApiHandler } from "@/server/api/with-api-handler";
import { listDoctorPatients } from "@/server/services/doctor-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return listDoctorPatients(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);
