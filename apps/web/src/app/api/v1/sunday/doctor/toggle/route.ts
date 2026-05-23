import { toggleSundaySchema, type ToggleSundayInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const PATCH = withApiHandler<ToggleSundayInput>(
  async ({ session, body }) => {
    return SundayConsultService.toggleSundayConsult(session!.user!.id, body.enabled);
  },
  { auth: true, roles: ["doctor"], bodySchema: toggleSundaySchema },
);
