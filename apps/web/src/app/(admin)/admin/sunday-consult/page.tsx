import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminSundayControl } from "@/features/admin/components/admin-sunday-control";

export const metadata = { title: "Sunday consult control" };

export default function AdminSundayConsultPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Programs"
        title="Sunday free consult"
        description="Enable or disable the program, configure slots, and follow request progress. Doctors pick patients themselves."
      />
      <AdminSundayControl />
    </>
  );
}
