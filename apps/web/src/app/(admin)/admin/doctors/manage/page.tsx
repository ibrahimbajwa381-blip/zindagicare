import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDoctorsManagement } from "@/features/admin/components/admin-doctors-management";

export const metadata = { title: "Doctor management" };

export default function AdminDoctorsManagePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title="Doctor management"
        description="Manage your full doctor directory — profiles, listings, home visits, Sunday consult, and weekly schedules."
      />
      <AdminDoctorsManagement />
    </>
  );
}
