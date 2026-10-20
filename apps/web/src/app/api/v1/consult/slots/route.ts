import { listConsultSlotsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

// Not `public: true` — the session (optional) lets a patient's own unpaid hold
// show as resumable instead of booked.
export const GET = withApiHandler(async ({ searchParams, session }) => {
  const query = listConsultSlotsQuerySchema.parse({
    doctorId: searchParams.get("doctorId"),
    date: searchParams.get("date") ?? undefined,
  });
  return OnlineConsultService.getSlotsForDoctor(query.doctorId, query.date, session?.user?.id);
});
