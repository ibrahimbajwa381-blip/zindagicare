import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { auth } from "@/lib/auth";
import { AppError } from "@zindagi/shared";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import { readChatVoiceNote } from "@/server/services/chat-attachment.storage";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { key: keyParts } = await params;
    const storageKey = decodeURIComponent(keyParts.join("/"));
    validateStorageKey(storageKey);

    const threadId = storageKey.split("/")[0];
    await ChatService.assertParticipant(threadId, session.user.id);

    const raw = await readChatVoiceNote(storageKey);
    const buffer = unwrapEncryptedFile(raw);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromKey(storageKey),
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
