import { listConsultDoctorsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const query = listConsultDoctorsQuerySchema.parse({
      city: searchParams.get("city") || undefined,
      specialty: searchParams.get("specialty") ?? undefined,
      homeVisit: searchParams.get("homeVisit") === "1",
    });
    return OnlineConsultService.listConsultDoctors(query.city, query.specialty, query.homeVisit);
  },
  { public: true },
);
