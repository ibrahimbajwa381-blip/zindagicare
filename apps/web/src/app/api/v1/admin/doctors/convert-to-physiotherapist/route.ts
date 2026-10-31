import { convertDoctorToPhysiotherapistSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { convertDoctorApplicationToPhysiotherapist } from "@/server/services/physiotherapist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return convertDoctorApplicationToPhysiotherapist(session!.user.id, body.doctorProfileId);
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: convertDoctorToPhysiotherapistSchema,
  },
);
