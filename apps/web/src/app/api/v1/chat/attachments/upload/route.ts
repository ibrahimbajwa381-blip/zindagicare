import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError } from "@zindagi/shared";
import { ChatService } from "@/server/services/chat.service";
import { saveChatVoiceNote } from "@/server/services/chat-attachment.storage";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const formData = await req.formData();
    const threadId = formData.get("threadId");
    const file = formData.get("file");

    if (typeof threadId !== "string" || !threadId) {
      throw new AppError("threadId is required", "VALIDATION_ERROR", 400);
    }
    if (!(file instanceof File)) {
      throw new AppError("Voice note file is required", "VALIDATION_ERROR", 400);
    }

    await ChatService.assertParticipant(threadId, session.user.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await saveChatVoiceNote(threadId, buffer, file.type);

    return apiSuccess(stored);
  } catch (error) {
    return apiError(error);
  }
}
