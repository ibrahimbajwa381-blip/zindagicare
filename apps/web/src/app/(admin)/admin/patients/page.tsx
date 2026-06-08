import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPatientViewer } from "@/features/admin/components/admin-patient-viewer";

export const metadata = { title: "Patients" };

export default function AdminPatientsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Patient records"
        title="Patient directory"
        description="Search patients by name or phone and review their booking and care history."
      />
      <AdminPatientViewer />
    </>
  );
}
