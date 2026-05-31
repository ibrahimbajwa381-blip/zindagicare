import { updatePatientProfileSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getPatientProfile,
  updatePatientProfile,
} from "@/server/services/patient-profile.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getPatientProfile(session!.user.id);
  },
  { auth: true },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    return updatePatientProfile(session!.user.id, body);
  },
  { auth: true, bodySchema: updatePatientProfileSchema },
);
