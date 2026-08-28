import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

/** Surfaces the patient's current/most-recent online consult, mirroring
 * loadPatientOnlineBooking() used server-side by the web dashboard. */
export const GET = withApiHandler(
  async ({ session }) => OnlineConsultService.getPatientBooking(session!.user!.id),
  { auth: true },
);
