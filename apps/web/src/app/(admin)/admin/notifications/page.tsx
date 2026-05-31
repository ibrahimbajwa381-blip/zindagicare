import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminNotificationsPanel } from "@/features/admin/components/admin-notifications-panel";

export const metadata = { title: "Notifications" };

export default function AdminNotificationsPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Notifications"
        description="Send manual in-app, SMS, or email messages to users or broadcast system-wide."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminNotificationsPanel />
      </div>
    </PageShell>
  );
}
