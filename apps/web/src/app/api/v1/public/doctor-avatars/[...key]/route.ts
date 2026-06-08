import { readFile } from "fs/promises";
import { apiError } from "@/server/api/response";
import { resolveDoctorAvatarPath } from "@/server/services/doctor-avatar.storage";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { key } = await params;
    if (!key.length) {
      throw new AppError("Not found", "NOT_FOUND", 404);
    }

    const storageKey = key.map((segment) => decodeURIComponent(segment)).join("/");
    const absolutePath = resolveDoctorAvatarPath(storageKey);
    const buffer = await readFile(absolutePath);
    const ext = storageKey.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
