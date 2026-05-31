import {
  createHomeVisitSchema,
  listHomeVisitsQuerySchema,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { HomeVisitService } from "@/server/services/home-visit.service";

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const query = listHomeVisitsQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      scope: searchParams.get("scope") ?? "mine",
    });
    return HomeVisitService.listVisits(
      session!.user.id,
      session!.user.roles ?? [],
      query.scope,
      query.status,
    );
  },
  { auth: true },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    return HomeVisitService.createRequest(session!.user.id, body);
  },
  { auth: true, bodySchema: createHomeVisitSchema },
);
