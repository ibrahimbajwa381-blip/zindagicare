import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { AppError } from "@zindagi/shared";
import { resolveSession } from "@/server/api/resolve-session";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import { readChatAttachment } from "@/server/services/chat-attachment.storage";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { key: keyParts } = await params;
    const storageKey = decodeURIComponent(keyParts.join("/"));
    validateStorageKey(storageKey);

    const threadId = storageKey.split("/")[0];
    await ChatService.assertParticipant(threadId, session.user.id);

    const raw = await readChatAttachment(storageKey);
    const buffer = unwrapEncryptedFile(raw);
    const contentType = contentTypeFromKey(storageKey);
    const isInline = contentType.startsWith("image/") || contentType.startsWith("audio/") || contentType === "application/pdf";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": isInline ? "inline" : `attachment; filename="${storageKey.split("/").pop()}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      return new Response(e.message, { status: e.statusCode });
    }
    return new Response("Not found", { status: 404 });
  }
}
