import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminNotificationsPanel } from "@/features/admin/components/admin-notifications-panel";

export const metadata = { title: "Notifications" };

export default function AdminNotificationsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Communications"
        title="Notifications"
        description="Send in-app, SMS, or email messages to users or broadcast system-wide announcements."
      />
      <AdminNotificationsPanel />
    </>
  );
}
