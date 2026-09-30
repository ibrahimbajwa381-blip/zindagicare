import { redirect } from "next/navigation";
import { ADMIN_PLATFORM_REVIEWS_HREF } from "@/features/admin/lib/admin-review-categories";

/** Testimonials moved under Reviews; keep old links and bookmarks working. */
export default function AdminTestimonialsPage() {
  redirect(ADMIN_PLATFORM_REVIEWS_HREF);
}
