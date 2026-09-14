import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { resolveSession } from "@/server/api/resolve-session";
import { apiError } from "@/server/api/response";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import { canHerbalistAccessDocument } from "@/server/services/herbalist-profile.service";
import { readHerbalistDocument } from "@/server/services/herbalist-documents.storage";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { key } = await params;
    const storageKey = decodeURIComponent(key.join("/"));
    validateStorageKey(storageKey);

    const allowed = await canHerbalistAccessDocument(
      session.user.id,
      session.user.roles ?? [],
      storageKey,
    );
    if (!allowed) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const raw = await readHerbalistDocument(storageKey);
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
