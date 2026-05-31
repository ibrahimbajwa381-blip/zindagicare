import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminAppointmentsBoard } from "@/features/admin/components/admin-appointments-board";

export const metadata = { title: "Appointments" };

export default function AdminAppointmentsPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Appointment management"
        description="View all bookings, filter by type, cancel or reassign doctors."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminAppointmentsBoard />
      </div>
    </PageShell>
  );
}
