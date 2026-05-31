import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminDashboardOverview } from "@/features/admin/components/admin-dashboard-overview";

export const metadata = { title: "Admin dashboard" };

export default function AdminHomePage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Admin dashboard"
        description="Monitor operations, manage doctors, bookings, Sunday consult, and home care."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminDashboardOverview />
      </div>
    </PageShell>
  );
}
