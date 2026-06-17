import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import { canDoctorAccessDocument } from "@/server/services/doctor-profile.service";
import { readDoctorDocument } from "@/server/services/doctor-documents.storage";
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

    const allowed = await canDoctorAccessDocument(
      session.user.id,
      session.user.roles ?? [],
      storageKey,
    );
    if (!allowed) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const raw = await readDoctorDocument(storageKey);
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
