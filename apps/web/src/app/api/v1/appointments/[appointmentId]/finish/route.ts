import { finishConsultSchema, type FinishConsultInput } from "@zindagi/validators";
import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ConsultationLifecycleService } from "@/server/services/consultation/consultation-lifecycle.service";

/** Path is always /api/v1/appointments/<appointmentId>/finish for this route. */
function appointmentIdFromUrl(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return segments[segments.length - 2] ?? "";
}

// Built once at module load so the rate limit accumulates across requests;
// the appointment id is read off the URL (see withApiHandler).
export const POST = withApiHandler<FinishConsultInput>(
  async ({ session, body, req }) =>
    ConsultationLifecycleService.finish(
      appointmentIdFromUrl(req.url),
      session!.user!.id,
      body.outcome,
      body.doctorNotes,
    ),
  {
    auth: true,
    roles: [Roles.DOCTOR, Roles.HERBALIST, Roles.NUTRITIONIST],
    bodySchema: finishConsultSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
);
