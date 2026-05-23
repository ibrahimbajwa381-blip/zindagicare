import {
  upsertTemplateSchema,
  type UpsertTemplateInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const PUT = withApiHandler<UpsertTemplateInput>(
  async ({ session, body }) => {
    return SundayConsultService.upsertTemplate(session!.user!.id, body);
  },
  { auth: true, roles: ["doctor"], bodySchema: upsertTemplateSchema },
);
