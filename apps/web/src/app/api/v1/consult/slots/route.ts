import { listConsultSlotsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const query = listConsultSlotsQuerySchema.parse({
      doctorId: searchParams.get("doctorId"),
      date: searchParams.get("date") ?? undefined,
    });
    return OnlineConsultService.getSlotsForDoctor(query.doctorId, query.date);
  },
  { public: true },
);
