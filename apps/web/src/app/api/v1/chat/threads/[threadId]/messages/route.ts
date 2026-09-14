import {
  listChatMessagesQuerySchema,
  sendChatMessageSchema,
  type SendChatMessageInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ threadId: string }> };

/** Path is always /api/v1/chat/threads/<threadId>/messages for this route. */
function threadIdFromUrl(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return segments[segments.length - 2] ?? "";
}

export async function GET(req: Request, { params }: Params) {
  const { threadId } = await params;
  const url = new URL(req.url);

  const handler = withApiHandler(
    async ({ session }) => {
      const query = listChatMessagesQuerySchema.parse({
        before: url.searchParams.get("before") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      });
      return ChatService.listMessages(threadId, session!.user!.id, query);
    },
    { auth: true },
  );

  return handler(req as never);
}

// Built once at module load (not inside POST) so the rateLimit budget below
// actually accumulates across requests instead of resetting every call —
// see the warning in withApiHandler's doc comment. threadId is read off the
// URL rather than closed over, since it isn't known until this line runs.
const postMessageHandler = withApiHandler<SendChatMessageInput>(
  async ({ session, body, req }) => {
    const threadId = threadIdFromUrl(req.url);
    return ChatService.sendMessage(
      threadId,
      session!.user!.id,
      body.body,
      body.locale,
      body.attachmentUrl
        ? { url: body.attachmentUrl, mime: body.attachmentMime ?? "audio/webm" }
        : undefined,
    );
  },
  {
    auth: true,
    bodySchema: sendChatMessageSchema,
    rateLimit: {
      limit: 60,
      windowMs: 60_000,
      message: "You're sending messages too quickly. Please slow down.",
    },
  },
);

export async function POST(req: Request, _ctx: Params) {
  return postMessageHandler(req as never);
}
