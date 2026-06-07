import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

export const GET = withApiHandler(async ({ session }) =>
  OnlineConsultService.getPatientBooking(session!.user!.id),
{ auth: true });
