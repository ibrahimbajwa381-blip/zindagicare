"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";
import { VerificationStatuses } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { ChevronRight, ExternalLink, ShieldCheck, X } from "lucide-react";
import { DoctorAvatar } from "@/features/doctor/components/doctor-avatar";
import {
  DOCTOR_APPROVED_NAV_SECTIONS,
  DOCTOR_ONBOARDING_NAV_SECTIONS,
  doctorNavBadgeCount,
  type DoctorWorkspaceNavItem,
} from "@/features/doctor/data/doctor-workspace-nav";
import { useDoctorNavStats } from "@/features/doctor/hooks/use-doctor-nav-stats";
import { doctorProfilePath } from "@/lib/doctors/profile-path";

type DoctorSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  showFullNav: boolean;
  verificationStatus?: string | null;
  doctorSlug?: string | null;
  doctorName: string;
  doctorAvatarUrl?: string | null;
};

function NavBadge({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
        active
          ? "bg-white/25 text-white"
          : "bg-brand/90 text-white shadow-sm shadow-brand/30",
      )}
    >
      {label}
    </span>
  );
}

export function DoctorSidebar({
  mobileOpen,
  onMobileClose,
  showFullNav,
  verificationStatus,
  doctorSlug,
  doctorName,
  doctorAvatarUrl,
}: DoctorSidebarProps) {
  const pathname = usePathname();
  const navStats = useDoctorNavStats({
    enabled: showFullNav,
    refreshOnFocus: true,
    refreshKey: pathname,
  });

  function isActive(item: DoctorWorkspaceNavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const sections = showFullNav ? DOCTOR_APPROVED_NAV_SECTIONS : DOCTOR_ONBOARDING_NAV_SECTIONS;
  const showVerificationLink =
    !showFullNav && verificationStatus === VerificationStatuses.REJECTED;
  const publicProfileHref = doctorSlug ? doctorProfilePath(doctorSlug) : null;

  const navContent = (
    <>
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5 sm:h-[4.75rem]">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
          aria-hidden
        />
        <DoctorAvatar
          name={doctorName}
          avatarUrl={doctorAvatarUrl}
          size="md"
          className="ring-2 ring-white/15 shadow-lg shadow-black/20"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {doctorName}
          </p>
          <p className="truncate text-xs text-slate-400">
            {siteConfig.name} · Doctor workspace
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 px-3 py-4">
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2.5 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                {section.title}
                <span className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  const badge = doctorNavBadgeCount(item, navStats);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200",
                        active
                          ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-md shadow-brand/20"
                          : "text-slate-300 hover:bg-white/6 hover:text-white",
                      )}
                    >
                      {active && (
                        <span
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-white/70"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium leading-none">
                            {item.label}
                          </span>
                          {badge !== null && (
                            <NavBadge count={badge} active={active} />
                          )}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-[11px] leading-snug",
                            active
                              ? "text-white/75"
                              : "text-slate-500 group-hover:text-slate-400",
                          )}
                        >
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "mt-2 h-3.5 w-3.5 shrink-0 transition-all duration-200",
                          active
                            ? "text-white/70"
                            : "text-slate-600 opacity-0 group-hover:translate-x-0.5 group-hover:text-slate-400 group-hover:opacity-100",
                        )}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {showVerificationLink && (
            <div>
              <p className="mb-2.5 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                Application
                <span className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </p>
              <Link
                href="/doctor/verification"
                onClick={onMobileClose}
                className={cn(
                  "group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200",
                  pathname.startsWith("/doctor/verification")
                    ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-md shadow-brand/20"
                    : "text-slate-300 hover:bg-white/6 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    pathname.startsWith("/doctor/verification")
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white",
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="text-sm font-medium">Resubmit application</span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Update credentials and documents
                  </span>
                </span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-white/8 bg-black/15 px-3 py-3">
        {publicProfileHref && (
          <Link
            href={publicProfileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            View public profile
          </Link>
        )}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
        >
          Back to {siteConfig.name}
        </Link>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu overlay"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col overflow-hidden border-r border-white/6 bg-gradient-to-b from-[#0f172a] via-[#0c1524] to-[#08111f] shadow-[4px_0_32px_rgba(0,0,0,0.18)] transition-transform duration-200 lg:z-40 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand/8 to-transparent"
          aria-hidden
        />
        <div className="relative flex min-h-0 flex-1 flex-col">{navContent}</div>
      </aside>
    </>
  );
}
