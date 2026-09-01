import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminActivityLog } from "@/features/admin/components/admin-activity-log";

export const metadata = { title: "Activity log" };

export default function AdminActivityPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Product insight"
        title="Activity log"
        description="Every meaningful patient and doctor action across web and mobile — logins, bookings, prescription views, failed actions — so you can see which features get used and where people get stuck."
      />
      <AdminActivityLog />
    </>
  );
}
