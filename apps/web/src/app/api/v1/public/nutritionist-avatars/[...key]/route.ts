import { apiError } from "@/server/api/response";
import {
  contentTypeFromKey,
  validateStorageKey,
} from "@/server/lib/object-storage";
import { readNutritionistAvatar } from "@/server/services/nutritionist-avatar.storage";
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
    const buffer = await readNutritionistAvatar(storageKey);

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
