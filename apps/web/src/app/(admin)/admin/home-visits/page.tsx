import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminHomeVisitsBoard } from "@/features/home-care/components/admin-home-visits-board";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";

export const metadata = {
  title: "Home care dispatch",
  description: "Assign nurses and track in-house medical visits in Lahore.",
};

export default function AdminHomeVisitsPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Home care dispatch"
        description="Assign nurses to pending visits and monitor active home care requests in Lahore."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminHomeVisitsBoard />
      </div>
    </PageShell>
  );
}
