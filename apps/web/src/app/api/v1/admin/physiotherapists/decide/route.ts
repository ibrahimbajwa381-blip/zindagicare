import { adminPhysiotherapistDecisionSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { decidePhysiotherapistVerification } from "@/server/services/physiotherapist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return decidePhysiotherapistVerification(
      session!.user.id,
      body.staffProfileId,
      body.action,
      body.rejectionReason,
    );
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminPhysiotherapistDecisionSchema,
  },
);
