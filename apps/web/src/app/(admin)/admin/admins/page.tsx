import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminUsersManagement } from "@/features/admin/components/admin-users-management";

export const metadata = { title: "Admin users" };

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Access control"
        title="Admin users"
        description="Grant or revoke admin access for doctors, staff, or any registered user. Admins with multiple roles can switch between profiles from their doctor or admin dashboard."
      />
      <AdminUsersManagement />
    </>
  );
}
