import { apiError } from "@/server/api/response";
import { cachedBuffer } from "@/server/lib/cache";
import {
  contentTypeFromKey,
  validateStorageKey,
} from "@/server/lib/object-storage";
import { readPhysiotherapistAvatar } from "@/server/services/physiotherapist-avatar.storage";
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
    const buffer = await cachedBuffer(`avatar:physiotherapist:${storageKey}`, 86400, () =>
      readPhysiotherapistAvatar(storageKey),
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromKey(storageKey),
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
