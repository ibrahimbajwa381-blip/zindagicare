import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ threadId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { threadId } = await params;

  const handler = withApiHandler(
    async ({ session }) => {
      return ChatService.markThreadRead(threadId, session!.user!.id);
    },
    { auth: true },
  );

  return handler(req as never);
}
