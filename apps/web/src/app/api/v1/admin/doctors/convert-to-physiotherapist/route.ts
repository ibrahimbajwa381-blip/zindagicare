import { convertDoctorToPhysiotherapistSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { convertDoctorApplicationToPhysiotherapist } from "@/server/services/physiotherapist.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return convertDoctorApplicationToPhysiotherapist(session!.user.id, body.doctorProfileId);
  },
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: convertDoctorToPhysiotherapistSchema,
  },
);
