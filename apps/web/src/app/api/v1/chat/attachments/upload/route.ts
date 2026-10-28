import { apiError, apiSuccess } from "@/server/api/response";
import { AppError } from "@zindagi/shared";
import { resolveSession } from "@/server/api/resolve-session";
import { ChatService } from "@/server/services/chat.service";
import { saveChatAttachment } from "@/server/services/chat-attachment.storage";

export async function POST(req: Request) {
  const startedAt = Date.now();
  let threadIdForLog: string | undefined;
  let stage = "auth";
  try {
    const session = await resolveSession(req);
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
      throw new AppError("Attachment file is required", "VALIDATION_ERROR", 400);
    }

    threadIdForLog = threadId;
    stage = "authorize";
    await ChatService.assertParticipant(threadId, session.user.id);

    stage = "storage";
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageStartedAt = Date.now();
    const stored = await saveChatAttachment(threadId, buffer, file.type);

    // Ids, sizes and timings only: never file contents, names or URLs.
    console.info("[chat-upload] stored", {
      threadId,
      mimeType: file.type,
      bytes: buffer.length,
      storageMs: Date.now() - storageStartedAt,
      totalMs: Date.now() - startedAt,
    });
    return apiSuccess(stored);
  } catch (error) {
    console.error("[chat-upload] failed", {
      threadId: threadIdForLog,
      stage,
      status: error instanceof AppError ? error.statusCode : 500,
      code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      error: error instanceof Error ? error.name : "unknown",
      // Storage rejection reason only (e.g. "mime type audio/webm is not supported"); no user data.
      cause: error instanceof Error && typeof error.cause === "string" ? error.cause : undefined,
      totalMs: Date.now() - startedAt,
    });
    return apiError(error);
  }
}
