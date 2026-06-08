import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getDoctorProfile,
  updateDoctorProfile,
} from "@/server/services/doctor-profile.service";
import { updateDoctorProfileSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    return getDoctorProfile(session!.user.id);
  },
  { auth: true, roles: ["doctor"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updateDoctorProfile(session!.user.id, body);
  },
  { auth: true, roles: ["doctor"], bodySchema: updateDoctorProfileSchema },
);
