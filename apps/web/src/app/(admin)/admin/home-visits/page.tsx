import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn, isAdminPanelUser } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { surfaceCard } from "@/lib/ui/surfaces";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import {
  ADMIN_HOME_VISITS_ROOT,
  ADMIN_HOME_VISIT_PROVIDER_LIST,
  adminHomeVisitsHref,
} from "@/features/home-care/lib/admin-home-visit-providers";
import { HomeVisitService } from "@/server/services/home-visit.service";

export const metadata = {
  title: "Home visits",
  description: "Doctor, physiotherapist and nurse home visit queues.",
};

type Props = {
  searchParams: Promise<{ visitId?: string | string[] }>;
};

/**
 * Entry point for all home-visit queues. Links that only know a visit id
 * (e.g. admin notifications) land here and are forwarded to the right queue.
 */
export default async function AdminHomeVisitsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${ADMIN_HOME_VISITS_ROOT}`);
  if (!isAdminPanelUser(session.user.roles)) redirect("/dashboard");

  const { visitId } = await searchParams;
  if (typeof visitId === "string" && visitId) {
    const kind = await HomeVisitService.getVisitProviderKind(visitId);
    if (kind) redirect(adminHomeVisitsHref(kind, visitId));
  }

  const openCounts = await HomeVisitService.countOpenVisitsByProvider();

  return (
    <>
      <AdminPageHeader
        eyebrow="Home treatment"
        title="Home visits"
        description="Each provider type has its own dispatch queue. Pick one to assign, track and close visits."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ADMIN_HOME_VISIT_PROVIDER_LIST.map((provider) => {
          const open = openCounts[provider.kind];
          return (
            <Link
              key={provider.kind}
              href={provider.href}
              className={cn(
                surfaceCard,
                "group flex items-start justify-between gap-3 p-5 transition-shadow hover:shadow-md",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{provider.navLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{provider.navDescription}</p>
                <p className="mt-3 text-sm">
                  <span className="font-semibold text-slate-900">{open}</span>{" "}
                  <span className="text-slate-500">
                    open {open === 1 ? "visit" : "visits"}
                  </span>
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
