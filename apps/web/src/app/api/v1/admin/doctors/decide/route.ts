import { adminDoctorDecisionSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { decideDoctorVerification } from "@/server/services/doctor-verification.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const profile = await decideDoctorVerification(
      session!.user.id,
      body.doctorProfileId,
      body.action,
      body.rejectionReason,
      body.verifiedSpecialties,
    );
    return {
      id: profile._id.toString(),
      verificationStatus: profile.verificationStatus,
      isListed: profile.isListed,
    };
  },
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: adminDoctorDecisionSchema,
  },
);
