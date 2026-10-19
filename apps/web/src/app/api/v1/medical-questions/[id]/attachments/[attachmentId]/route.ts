import { AppError } from "@zindagi/shared";
import { resolveSession } from "@/server/api/resolve-session";
import { medicalQaPathIds, rateLimitMedicalQa, viewerFrom } from "@/server/api/medical-qa-route";
import { MedicalQaService, medicalQaLimiters } from "@/server/services/medical-qa.service";

/**
 * Authorized proxy for a private Q&A photo. There are no public or signed
 * storage URLs: every request re-checks the viewer (owner, verified provider
 * or admin) and the photo is decrypted server-side. Headers keep the bytes
 * from ever being sniffed or rendered as an active document, and out of
 * shared caches.
 */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};

export async function GET(req: Request) {
  try {
    const session = await resolveSession(req);
    const viewer = viewerFrom(session);
    if (!viewer) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    await rateLimitMedicalQa(medicalQaLimiters.viewAttachment, req, session);

    const [questionId = "", , attachmentId = ""] = medicalQaPathIds(req.url);
    const { buffer, contentType } = await MedicalQaService.readAttachment(viewer, questionId, attachmentId);

    return new Response(new Uint8Array(buffer), {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": contentType,
        "Content-Disposition": 'inline; filename="photo.webp"',
      },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.statusCode : 500;
    if (!(e instanceof AppError)) console.error("[medical-qa] attachment read failed");
    const headers: Record<string, string> = { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" };
    if (e instanceof AppError && e.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(Math.ceil(e.retryAfterSeconds));
    }
    return new Response(status === 500 ? "Something went wrong" : (e as AppError).message, { status, headers });
  }
}
