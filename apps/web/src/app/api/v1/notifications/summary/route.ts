import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";
import { getNotificationSummary } from "@/server/services/notification.service";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";

export const GET = withApiHandler(
  async ({ session }) => {
    const userId = session!.user!.id;
    const roles = session!.user!.roles ?? [];
    if (roles.includes("doctor")) {
      AppointmentReminderService.triggerFromNavigation();
    }

    const [summary, chatUnreadCount] = await Promise.all([
      getNotificationSummary(userId),
      ChatService.totalUnreadCount(userId),
    ]);

    return { ...summary, chatUnreadCount };
  },
  { auth: true },
);
