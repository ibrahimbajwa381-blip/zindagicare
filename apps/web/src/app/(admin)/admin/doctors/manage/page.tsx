import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminDoctorsManagement } from "@/features/admin/components/admin-doctors-management";

export const metadata = { title: "Doctor management" };

export default function AdminDoctorsManagePage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Doctor management"
        description="Add doctors manually, activate or deactivate listings, and set weekly availability."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminDoctorsManagement />
      </div>
    </PageShell>
  );
}
