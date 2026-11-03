import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { sundayFreeOutcomeSchema, type SundayFreeOutcomeInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/** Path is always /api/v1/admin/sunday/requests/<id>/outcome for this route. */
function requestIdFromUrl(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return segments[segments.length - 2] ?? "";
}

/** Admin marks a Sunday consult as well completed or not, with an internal note. */
export const POST = withApiHandler<SundayFreeOutcomeInput>(
  async ({ session, body, req }) =>
    SundayConsultService.setAdminOutcome(
      session!.user!.id,
      requestIdFromUrl(req.url),
      body.outcome,
      body.note || undefined,
    ),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: sundayFreeOutcomeSchema,
  },
);
