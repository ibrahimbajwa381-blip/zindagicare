import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminActivityAuditLog } from "@/features/admin/components/admin-activity-audit-log";

export const metadata = { title: "Admin activity" };

export default function AdminAdminActivityPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Compliance"
        title="Admin activity"
        description="Audit trail of admin-initiated actions — who changed what, when, and for which patient, doctor, or appointment."
      />
      <AdminActivityAuditLog />
    </>
  );
}
