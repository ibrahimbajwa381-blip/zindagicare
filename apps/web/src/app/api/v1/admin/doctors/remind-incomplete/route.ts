import { withApiHandler } from "@/server/api/with-api-handler";
import { sendIncompleteProfileReminders } from "@/server/services/doctor-profile-reminder.service";

export const POST = withApiHandler(
  async ({ session }) => sendIncompleteProfileReminders(session!.user.id),
  {
    auth: true,
    roles: ["admin", "super_admin"],
    rateLimit: {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      message: "Reminders were sent recently. Please wait before sending again.",
    },
  },
);
