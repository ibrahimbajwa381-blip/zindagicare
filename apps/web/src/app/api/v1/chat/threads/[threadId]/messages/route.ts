import {
  listChatMessagesQuerySchema,
  sendChatMessageSchema,
  type SendChatMessageInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { threadId } = await params;
  const url = new URL(req.url);
  const query = listChatMessagesQuerySchema.parse({
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  const handler = withApiHandler(
    async ({ session }) => {
      return ChatService.listMessages(threadId, session!.user!.id, query);
    },
    { auth: true },
  );

  return handler(req as never);
}

export async function POST(req: Request, { params }: Params) {
  const { threadId } = await params;

  const handler = withApiHandler<SendChatMessageInput>(
    async ({ session, body }) => {
      return ChatService.sendMessage(
        threadId,
        session!.user!.id,
        body.body,
        body.locale,
      );
    },
    { auth: true, bodySchema: sendChatMessageSchema },
  );

  return handler(req as never);
}
