import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminSubNav } from "@/features/admin/components/admin-sub-nav";
import { AdminSundayControl } from "@/features/admin/components/admin-sunday-control";

export const metadata = { title: "Sunday consult control" };

export default function AdminSundayConsultPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Sunday free consult"
        description="Enable or disable the program, configure slots, view queue, and reset weekly availability."
      />
      <div className="mt-8">
        <AdminSubNav />
        <AdminSundayControl />
      </div>
    </PageShell>
  );
}
