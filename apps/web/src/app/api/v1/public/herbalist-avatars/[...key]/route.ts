import { apiError } from "@/server/api/response";
import { cachedBuffer } from "@/server/lib/cache";
import {
  contentTypeFromKey,
  validateStorageKey,
} from "@/server/lib/object-storage";
import { readHerbalistAvatar } from "@/server/services/herbalist-avatar.storage";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { key } = await params;
    if (!key.length) {
      throw new AppError("Not found", "NOT_FOUND", 404);
    }

    const storageKey = key
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    validateStorageKey(storageKey);
    // Avatar keys embed a random UUID per upload, so a key's bytes never change.
    const buffer = await cachedBuffer(`avatar:herbalist:${storageKey}`, 86400, () =>
      readHerbalistAvatar(storageKey),
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromKey(storageKey),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
