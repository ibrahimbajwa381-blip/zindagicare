import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPatientsManagement } from "@/features/admin/components/admin-patients-management";

export const metadata = { title: "Patients" };

export default function AdminPatientsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Patient records"
        title="Patient directory"
        description="Search patients, review care activity and spending, and manage account access — bans, no-shows, and deactivation."
      />
      <AdminPatientsManagement />
    </>
  );
}
