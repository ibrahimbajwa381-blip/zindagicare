import {
  sundayFreeRequestSchema,
  type SundayFreeRequestInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<SundayFreeRequestInput>(
  async ({ session, body }) => {
    return SundayConsultService.submitRequest(session!.user!.id, body);
  },
  {
    auth: true,
    bodySchema: sundayFreeRequestSchema,
    rateLimit: {
      limit: 5,
      windowMs: 60_000,
      message: "Too many requests. Please wait a moment before trying again.",
    },
  },
);

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    return SundayConsultService.getPatientRequest(session!.user!.id, date);
  },
  { auth: true },
);
