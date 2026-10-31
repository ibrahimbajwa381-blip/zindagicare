import { withApiHandler } from "@/server/api/with-api-handler";
import { sendIncompleteProfileReminders } from "@/server/services/doctor-profile-reminder.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ session }) => sendIncompleteProfileReminders(session!.user.id),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    rateLimit: {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      message: "Reminders were sent recently. Please wait before sending again.",
    },
  },
);
