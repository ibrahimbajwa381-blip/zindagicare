import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@zindagi/shared";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminReviewModeration } from "@/features/admin/components/admin-review-moderation";
import { AdminTestimonialsPanel } from "@/features/admin/components/admin-testimonials-panel";
import {
  adminReviewApiBase,
  adminReviewCategoryBySlug,
  adminReviewTab,
  adminReviewTabHref,
  type AdminReviewSource,
} from "@/features/admin/lib/admin-review-categories";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ source?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { category: slug } = await params;
  const category = adminReviewCategoryBySlug(slug);
  if (!category) return { title: "Reviews" };
  return { title: category.pageTitle, description: category.pageDescription };
}

function ReviewSourcePanel({ source }: { source: AdminReviewSource }) {
  if (source.kind === "platform") return <AdminTestimonialsPanel />;
  const apiBase = adminReviewApiBase(source);
  return <AdminReviewModeration key={apiBase} apiBase={apiBase} />;
}

export default async function AdminReviewCategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params;
  const category = adminReviewCategoryBySlug(slug);
  if (!category) notFound();

  const { source } = await searchParams;
  const activeTab = adminReviewTab(category, typeof source === "string" ? source : undefined);

  return (
    <>
      <AdminPageHeader
        eyebrow="Reviews"
        title={category.pageTitle}
        description={category.pageDescription}
      />
      {category.tabs.length > 1 && (
        <nav aria-label="Review source" className="mb-6 flex flex-wrap gap-2">
          {category.tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <Link
                key={tab.id}
                href={adminReviewTabHref(category, tab)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-muted text-brand-dark"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}
      <ReviewSourcePanel source={activeTab.source} />
    </>
  );
}
