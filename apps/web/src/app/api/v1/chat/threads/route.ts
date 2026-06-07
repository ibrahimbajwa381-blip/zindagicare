import {
  createDirectThreadSchema,
  type CreateDirectThreadInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return ChatService.listThreads(session!.user!.id);
  },
  { auth: true },
);

export const POST = withApiHandler<CreateDirectThreadInput>(
  async ({ session, body }) => {
    return ChatService.getOrCreateDirectThread(
      session!.user!.id,
      body.participantId,
    );
  },
  { auth: true, bodySchema: createDirectThreadSchema },
);
