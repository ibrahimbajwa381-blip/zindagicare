import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPatientStats } from "@/features/admin/components/admin-patient-stats";

export const metadata = { title: "Patient statistics" };

export default function AdminPatientStatsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title="Patient statistics"
        description="Demographics, city coverage, appointment activity, and growth trends across the patient base."
      />
      <AdminPatientStats />
    </>
  );
}
