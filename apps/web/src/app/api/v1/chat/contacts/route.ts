import { listChatContactsQuerySchema } from "@zindagi/validators";
import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const query = listChatContactsQuerySchema.parse({
      q: searchParams.get("q") ?? undefined,
    });

    const userId = session!.user!.id;
    const roles = session!.user!.roles ?? [];

    if (roles.includes(Roles.DOCTOR)) {
      return ChatService.listDoctorContacts(userId, query.q);
    }

    return ChatService.listPatientContacts(userId, query.q);
  },
  { auth: true },
);
