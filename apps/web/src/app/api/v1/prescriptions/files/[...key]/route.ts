import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { resolveSession } from "@/server/api/resolve-session";
import { AppError } from "@zindagi/shared";
import { validateStorageKey } from "@/server/lib/object-storage";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  prescriptionContentDisposition,
  prescriptionDownloadFilename,
  readPrescriptionPdf,
} from "@/server/services/prescription.storage";
import { PrescriptionService } from "@/server/services/prescription.service";

type Params = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { key: keyParts } = await params;
    const storageKey = decodeURIComponent(keyParts.join("/"));
    validateStorageKey(storageKey);

    // Session lookup and the (remote) storage fetch don't depend on each other — run them
    // concurrently instead of paying both network round trips back-to-back. The DB
    // authorization check still gates the response, so an unauthorized request never sees
    // these bytes; it just means the storage fetch was occasionally wasted work.
    const [session, raw] = await Promise.all([resolveSession(req), readPrescriptionPdf(storageKey)]);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const prescription = await PrescriptionService.getByFileKey(
      storageKey,
      session.user.id,
      session.user.roles ?? [],
    );

    const buffer = unwrapEncryptedFile(raw);
    const mimeType = prescription.mimeType ?? "application/pdf";
    const patient = prescription.patientId as { name?: string } | null;
    const patientName = safeDisplayText(patient?.name) ?? "Patient";
    const filename = prescriptionDownloadFilename(patientName);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": prescriptionContentDisposition(filename),
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      return new Response(e.message, { status: e.statusCode });
    }
    return new Response("Not found", { status: 404 });
  }
}
