import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDoctorStats } from "@/features/admin/components/admin-doctor-stats";

export const metadata = { title: "Doctor statistics" };

export default function AdminDoctorStatsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title="Doctor statistics"
        description="Specialty coverage, verification pipeline, city distribution, and service-enablement stats across the doctor network."
      />
      <AdminDoctorStats />
    </>
  );
}
