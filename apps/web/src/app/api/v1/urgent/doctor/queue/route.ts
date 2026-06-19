import { withApiHandler } from "@/server/api/with-api-handler";

/** MVP urgent care uses admin phone dispatch — no in-app doctor queue. */
export const GET = withApiHandler(async () => [], { auth: true });
