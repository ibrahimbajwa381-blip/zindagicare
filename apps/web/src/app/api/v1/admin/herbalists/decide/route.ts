import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { decideHerbalistVerification } from "@/server/services/herbalist-verification.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

const decideSchema = z.object({
  herbalistProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().min(3).max(500).optional(),
  verifiedSpecialties: z.array(z.string().min(1)).optional(),
});

export const POST = withApiHandler(
  async ({ session, body }) => {
    const profile = await decideHerbalistVerification(
      session!.user.id,
      body.herbalistProfileId,
      body.action,
      body.rejectionReason,
      body.verifiedSpecialties,
    );
    return { id: profile._id.toString(), status: profile.verificationStatus };
  },
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: decideSchema,
  },
);
