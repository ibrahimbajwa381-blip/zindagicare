import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDashboardOverview } from "@/features/admin/components/admin-dashboard-overview";

export const metadata = { title: "Admin dashboard" };

export default function AdminHomePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard overview"
        description="Monitor doctor onboarding, patient activity, appointments, home care dispatch, and platform health across ZindagiCare."
      />
      <AdminDashboardOverview />
    </>
  );
}
