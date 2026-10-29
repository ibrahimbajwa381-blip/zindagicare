import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPlanningBoard } from "@/features/admin/components/admin-planning-board";

export const metadata = { title: "Planning & growth" };

export default function AdminPlanningPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Business"
        title="Planning & growth"
        description="Our plans, monthly and city targets, hospital partnerships, campaigns, achievements and open challenges — one place to track how ZindagiCare is growing."
      />
      <AdminPlanningBoard />
    </>
  );
}
