import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminNursesManagement } from "@/features/admin/components/admin-nurses-management";

export const metadata = { title: "Nurse management" };

export default function AdminNursesManagePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title="Nurse management"
        description="Manage your nurse directory — profiles, availability, home visits, commission, and accounts."
      />
      <AdminNursesManagement />
    </>
  );
}
