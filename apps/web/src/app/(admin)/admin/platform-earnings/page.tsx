import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPlatformEarnings } from "@/features/admin/components/admin-platform-earnings";

export const metadata = { title: "ZindagiCare earnings" };

export default function AdminPlatformEarningsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Finances"
        title="ZindagiCare earnings"
        description="What the platform has made in commission from each doctor's completed, paid consultations."
      />
      <AdminPlatformEarnings />
    </>
  );
}
