import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminNurseQueue } from "@/features/admin/components/admin-nurse-queue";

export const metadata = { title: "Nurse verifications" };

export default function AdminNursesPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider onboarding"
        title="Nurse verifications"
        description="Review Nurse license documents and identity, then approve or reject. Only approved Nurses receive in-house visit assignments."
      />
      <AdminNurseQueue />
    </>
  );
}
