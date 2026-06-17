import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import {
  canAccessNurseDocument,
  readNurseDocument,
} from "@/server/services/nurse-documents.storage";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { key } = await params;
    const storageKey = decodeURIComponent(key.join("/"));
    validateStorageKey(storageKey);

    if (
      !canAccessNurseDocument(
        session.user.id,
        session.user.roles ?? [],
        storageKey,
      )
    ) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const raw = await readNurseDocument(storageKey);
    const buffer = unwrapEncryptedFile(raw);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromKey(storageKey),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
