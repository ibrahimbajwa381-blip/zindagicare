import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminPatientViewer } from "@/features/admin/components/admin-patient-viewer";

export const metadata = { title: "Patients" };

export default function AdminPatientsPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Patient viewer"
        description="Search patients by name or phone and review booking history."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminPatientViewer />
      </div>
    </PageShell>
  );
}
