import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    return SundayConsultService.getPatientBooking(session!.user!.id, date);
  },
  { auth: true },
);
