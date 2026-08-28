import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminUserAnalytics } from "@/features/admin/components/admin-user-analytics";

export const metadata = { title: "User analytics" };

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Platform growth"
        title="User analytics"
        description="Totals, growth, and role/city/age distribution across every registered account, with search and filters over the full user directory."
      />
      <AdminUserAnalytics />
    </>
  );
}
