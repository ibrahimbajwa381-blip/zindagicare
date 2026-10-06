import { listDoctorsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const query = listDoctorsQuerySchema.parse({
      city: searchParams.get("city") || undefined,
      date: searchParams.get("date") ?? undefined,
    });
    return SundayConsultService.listSundayDoctors(query.city, query.date);
  },
  { public: true },
);
