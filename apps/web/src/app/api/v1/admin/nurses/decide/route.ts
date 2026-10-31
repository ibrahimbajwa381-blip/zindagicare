import { adminNurseDecisionSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { decideNurseVerification } from "@/server/services/nurse.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return decideNurseVerification(
      session!.user.id,
      body.staffProfileId,
      body.action,
      body.rejectionReason,
    );
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminNurseDecisionSchema,
  },
);
