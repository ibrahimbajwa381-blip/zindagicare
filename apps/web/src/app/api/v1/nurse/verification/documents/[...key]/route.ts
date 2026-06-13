import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import {
  canAccessNurseDocument,
  resolveNurseDocumentPath,
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

    if (
      !canAccessNurseDocument(
        session.user.id,
        session.user.roles ?? [],
        storageKey,
      )
    ) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const absolutePath = resolveNurseDocumentPath(storageKey);
    const raw = await readFile(absolutePath);
    const buffer = unwrapEncryptedFile(raw);
    const ext = storageKey.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
