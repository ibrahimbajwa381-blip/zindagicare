import { withApiHandler } from "@/server/api/with-api-handler";
import { submitPhysiotherapistVerification } from "@/server/services/physiotherapist.service";
import { physiotherapistVerificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body }) => {
    return submitPhysiotherapistVerification(session!.user.id, body);
  },
  { auth: true, roles: ["physiotherapist"], bodySchema: physiotherapistVerificationSchema },
);
