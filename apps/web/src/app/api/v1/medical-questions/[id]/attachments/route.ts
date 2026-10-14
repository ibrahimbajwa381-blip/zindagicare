import { AppError } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readBodyBytes } from "@/server/api/read-json-body";
import { medicalQaPathIds, rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { MEDICAL_IMAGE_LIMITS } from "@/server/lib/medical-image-pipeline";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

/** Multipart framing allowance on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Owner-only photo upload. Cheap checks (auth, rate limit, content type,
 * ownership) all run before the body is read; the image is then verified,
 * re-encoded and stored privately by MedicalQaService.addAttachment.
 */
export const POST = withApiHandler(
  async ({ req, session }) => {
    await rateLimitMedicalQa(medicalQaLimiters.uploadAttachment, req, session);

    const contentType = req.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\b/i.test(contentType)) {
      throw new AppError("Expected a multipart/form-data upload", "UNSUPPORTED_MEDIA_TYPE", 415);
    }

    const viewer = viewerFrom(session)!;
    const [questionId = ""] = medicalQaPathIds(req.url);
    await MedicalQaService.assertCanAttach(viewer, questionId);

    // Declared size is checked first and the stream is capped, so an oversized
    // upload is refused without buffering it entirely.
    const raw = await readBodyBytes(
      req,
      MEDICAL_IMAGE_LIMITS.maxOriginalBytes + MULTIPART_OVERHEAD_BYTES,
      "Photo must be 10 MB or smaller",
    );

    let file: FormDataEntryValue | null;
    try {
      file = (await new Response(new Uint8Array(raw), { headers: { "content-type": contentType } }).formData()).get("file");
    } catch {
      throw new AppError("Malformed upload", "VALIDATION_ERROR", 400);
    }
    if (!(file instanceof File)) {
      throw new AppError("Photo file is required", "VALIDATION_ERROR", 400);
    }
    if (file.size > MEDICAL_IMAGE_LIMITS.maxOriginalBytes) {
      throw new AppError("Photo must be 10 MB or smaller", "IMAGE_TOO_LARGE", 413);
    }

    // The declared MIME type and filename are ignored: format comes from the bytes.
    const buffer = Buffer.from(await file.arrayBuffer());
    return MedicalQaService.addAttachment(viewer, questionId, buffer);
  },
  { auth: true },
);
