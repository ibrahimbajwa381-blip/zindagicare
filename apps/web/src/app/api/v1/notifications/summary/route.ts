import { withApiHandler } from "@/server/api/with-api-handler";
import { getNotificationSummary } from "@/server/services/notification.service";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";

export const GET = withApiHandler(
  async ({ session }) => {
    const roles = session!.user!.roles ?? [];
    if (roles.includes("doctor")) {
      void AppointmentReminderService.processDueReminders().catch(() => null);
    }

    return getNotificationSummary(session!.user!.id);
  },
  { auth: true },
);
