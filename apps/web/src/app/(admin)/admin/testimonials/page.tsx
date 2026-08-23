import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminTestimonialsPanel } from "@/features/admin/components/admin-testimonials-panel";

export const metadata = { title: "Testimonials" };

export default function AdminTestimonialsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Testimonials"
        description="Manage the experience stories shown on the public website. Hidden testimonials no longer appear on the homepage. New patient submissions go live automatically."
      />
      <AdminTestimonialsPanel />
    </>
  );
}
