import { Suspense } from "react";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminUrgentCareBoard } from "@/features/urgent-consult/components/admin-urgent-care-board";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata = {
  title: "Urgent care dispatch",
  description: "Assign doctors and review urgent care video consult history.",
};

export default function AdminUrgentCarePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Urgent care"
        title="Urgent care dispatch"
        description="Review patient urgent care requests, assign a doctor from your team, and start an in-app video consult within 10 minutes."
      />
      <Suspense fallback={<LoadingScreen message="Loading urgent care requests…" />}>
        <AdminUrgentCareBoard />
      </Suspense>
    </>
  );
}
