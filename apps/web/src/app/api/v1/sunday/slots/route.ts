import { listSlotsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const query = listSlotsQuerySchema.parse({
      doctorId: searchParams.get("doctorId"),
      date: searchParams.get("date") ?? undefined,
    });
    return SundayConsultService.getSlotsForDoctor(query.doctorId, query.date);
  },
  { public: true },
);
