import { doctorVerificationSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { submitDoctorVerification } from "@/server/services/doctor-verification.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const profile = await submitDoctorVerification(session!.user.id, body);
    return {
      id: profile._id.toString(),
      verificationStatus: profile.verificationStatus,
      submittedAt: profile.verificationSubmittedAt,
    };
  },
  { auth: true, roles: ["doctor"], bodySchema: doctorVerificationSchema },
);
