import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPhysiotherapistQueue } from "@/features/admin/components/admin-physiotherapist-queue";

export const metadata = { title: "Physiotherapist verifications" };

export default function AdminPhysiotherapistsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider onboarding"
        title="Physiotherapist verifications"
        description="Review Physiotherapist license documents and identity, then approve or reject. Only approved Physiotherapists receive in-house visit assignments."
      />
      <AdminPhysiotherapistQueue />
    </>
  );
}
