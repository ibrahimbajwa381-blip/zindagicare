import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminReviewModeration } from "@/features/admin/components/admin-review-moderation";

export const metadata = { title: "Patient reviews" };

export default function AdminReviewsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & safety"
        title="Patient reviews"
        description="Moderate doctor ratings and feedback. Hidden or removed reviews no longer affect public doctor profiles."
      />
      <AdminReviewModeration />
    </>
  );
}
