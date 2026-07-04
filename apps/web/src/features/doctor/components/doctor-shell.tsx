"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Menu, ShieldAlert } from "lucide-react";
import { cn } from "@zindagi/shared";
import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";
import { UnifiedHeader } from "@/components/layout/unified-header";
import { DoctorSidebar } from "@/features/doctor/components/doctor-sidebar";

export type DoctorAccountabilityBanner = {
  level: "info" | "warning" | "danger";
  monthMisses: number;
  warningThreshold: number;
  removalThreshold: number;
};

type DoctorShellProps = {
  children: ReactNode;
  showFullNav: boolean;
  verificationStatus?: string | null;
  doctorSlug?: string | null;
  doctorName?: string;
  doctorAvatarUrl?: string | null;
  accountabilityBanner?: DoctorAccountabilityBanner | null;
};

function AccountabilityBanner({ banner }: { banner: DoctorAccountabilityBanner }) {
  const remaining = Math.max(banner.removalThreshold - banner.monthMisses, 0);

  const styles = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-orange-200 bg-orange-50 text-orange-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[banner.level];

  const Icon = banner.level === "info" ? AlertTriangle : ShieldAlert;

  const title =
    banner.level === "danger"
      ? "Account restricted — missed consultations"
      : banner.level === "warning"
        ? "Warning: missed consultations"
        : "Attendance reminder";

  const message =
    banner.level === "danger"
      ? `You missed ${banner.monthMisses} consultations this month, so your account has been restricted and patients can no longer book you. Please contact the ZindagiCare admin team to restore your account.`
      : banner.level === "warning"
        ? `You've missed ${banner.monthMisses} consultations this month. Missing ${remaining} more will remove you from ZindagiCare. Please make sure you join your appointments on time.`
        : `You've missed ${banner.monthMisses} consultation${banner.monthMisses === 1 ? "" : "s"} this month. ${banner.warningThreshold} misses in a month triggers a formal warning and ${banner.removalThreshold} leads to removal — please join your appointments on time.`;

  return (
    <div className={cn("mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm", styles)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{message}</p>
      </div>
    </div>
  );
}

export function DoctorShell({
  children,
  showFullNav,
  verificationStatus,
  doctorSlug,
  doctorName = "Doctor",
  doctorAvatarUrl,
  accountabilityBanner,
}: DoctorShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="lg:pl-[17.5rem]">
        <UnifiedHeader
          navLinks={[]}
          showMobileNav={false}
          leadingSlot={
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          }
        />
      </div>

      <DoctorSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        showFullNav={showFullNav}
        verificationStatus={verificationStatus}
        doctorSlug={doctorSlug}
        doctorName={doctorName}
        doctorAvatarUrl={doctorAvatarUrl}
      />

      <div className={cn("flex min-h-[calc(100vh-4rem)] flex-col sm:min-h-[calc(100vh-4.75rem)] lg:pl-[17.5rem]")}>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[100rem]">
            <AutoBreadcrumbs variant="workspace" />
            {accountabilityBanner && (
              <AccountabilityBanner banner={accountabilityBanner} />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
