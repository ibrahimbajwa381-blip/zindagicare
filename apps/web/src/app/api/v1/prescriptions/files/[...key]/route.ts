import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { auth } from "@/lib/auth";
import { AppError } from "@zindagi/shared";
import { validateStorageKey } from "@/server/lib/object-storage";
import { readPrescriptionPdf } from "@/server/services/prescription.storage";
import { PrescriptionService } from "@/server/services/prescription.service";

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

    const prescription = await PrescriptionService.getByFileKey(
      storageKey,
      session.user.id,
      session.user.roles ?? [],
    );

    const raw = await readPrescriptionPdf(storageKey);
    const buffer = unwrapEncryptedFile(raw);
    const mimeType = prescription.mimeType ?? "application/pdf";
    const filename = `prescription-${prescription._id.toString()}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      return new Response(e.message, { status: e.statusCode });
    }
    return new Response("Not found", { status: 404 });
  }
}
