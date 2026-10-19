import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPlatformEarnings } from "@/features/admin/components/admin-platform-earnings";

export const metadata = { title: "ZindagiCare earnings" };

export default function AdminPlatformEarningsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Finances"
        title="ZindagiCare earnings"
        description="What the platform has made in commission from completed, paid consultations — plus visits booked outside the app and recorded manually."
      />
      <AdminPlatformEarnings />
    </>
  );
}
