import { withApiHandler } from "@/server/api/with-api-handler";
import { submitNurseVerification } from "@/server/services/nurse.service";
import { nurseVerificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return submitNurseVerification(session!.user.id, body);
  },
  { auth: true, roles: ["nurse"], bodySchema: nurseVerificationSchema },
);
