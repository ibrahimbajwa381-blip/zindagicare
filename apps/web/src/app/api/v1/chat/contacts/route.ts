import { listChatContactsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const query = listChatContactsQuerySchema.parse({
      q: searchParams.get("q") ?? undefined,
    });

    return ChatService.listContacts(session!.user!.id, query.q);
  },
  { auth: true },
);
