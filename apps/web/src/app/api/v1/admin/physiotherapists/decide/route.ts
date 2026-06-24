import { adminPhysiotherapistDecisionSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { decidePhysiotherapistVerification } from "@/server/services/physiotherapist.service";

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
    roles: ["admin", "super_admin"],
    bodySchema: adminPhysiotherapistDecisionSchema,
  },
);
