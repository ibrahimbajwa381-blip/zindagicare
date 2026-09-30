import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn, isAdmin } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { surfaceCard } from "@/lib/ui/surfaces";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import {
  ADMIN_REVIEWS_ROOT,
  ADMIN_REVIEW_CATEGORY_LIST,
} from "@/features/admin/lib/admin-review-categories";
import { getAdminNavCounts } from "@/server/services/admin-dashboard.service";

export const metadata = {
  title: "Reviews",
  description: "Doctor, physiotherapist, nurse and platform reviews.",
};

/** Entry point for all review queues — one card per category. */
export default async function AdminReviewsPage() {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${ADMIN_REVIEWS_ROOT}`);
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  const counts = await getAdminNavCounts();

  return (
    <>
      <AdminPageHeader
        eyebrow="Trust & safety"
        title="Reviews"
        description="Each review type has its own moderation queue. Pick one to approve, hide or remove reviews."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_REVIEW_CATEGORY_LIST.map((category) => {
          const pending = category.navCountKey ? counts[category.navCountKey] : null;
          return (
            <Link
              key={category.slug}
              href={category.href}
              className={cn(
                surfaceCard,
                "group flex items-start justify-between gap-3 p-5 transition-shadow hover:shadow-md",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{category.navLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{category.navDescription}</p>
                {pending !== null && (
                  <p className="mt-3 text-sm">
                    <span className="font-semibold text-slate-900">{pending}</span>{" "}
                    <span className="text-slate-500">need review</span>
                  </p>
                )}
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
