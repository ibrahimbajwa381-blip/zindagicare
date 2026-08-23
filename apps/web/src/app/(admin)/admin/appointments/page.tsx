import { Suspense } from "react";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminAppointmentsBoard } from "@/features/admin/components/admin-appointments-board";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata = { title: "Appointments" };

export default function AdminAppointmentsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Scheduling"
        title="Appointment management"
        description="View all bookings across online consult, clinic, Sunday free consult, and home care. Cancel or reassign as needed."
      />
      <Suspense fallback={<LoadingScreen message="Loading appointments…" />}>
        <AdminAppointmentsBoard />
      </Suspense>
    </>
  );
}
