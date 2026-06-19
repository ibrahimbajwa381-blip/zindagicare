import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminUrgentCareBoard } from "@/features/urgent-consult/components/admin-urgent-care-board";

export const metadata = {
  title: "Urgent care dispatch",
  description: "Assign on-call doctors to urgent care phone requests.",
};

export default function AdminUrgentCarePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Urgent care"
        title="Urgent care dispatch"
        description="Review patient urgent care requests, assign a doctor from your team, and coordinate a direct phone callback within 5–10 minutes."
      />
      <AdminUrgentCareBoard />
    </>
  );
}
