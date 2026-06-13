"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@zindagi/shared";
import { workspaceSidebarTop } from "@/lib/ui/surfaces";
import { VerificationStatuses } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { ChevronRight, ExternalLink, ShieldCheck, X } from "lucide-react";
import { fetchThreads } from "@/features/chat/lib/chat-api";
import {
  DOCTOR_APPROVED_NAV_SECTIONS,
  DOCTOR_ONBOARDING_NAV_SECTIONS,
  doctorNavBadgeCount,
  summaryToNavStats,
  type DoctorNavStats,
  type DoctorWorkspaceNavItem,
} from "@/features/doctor/data/doctor-workspace-nav";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { CHAT_UNREAD_EVENT } from "@/lib/chat/unread-events";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

type DoctorSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  showFullNav: boolean;
  verificationStatus?: string | null;
  doctorSlug?: string | null;
};

export function DoctorSidebar({
  mobileOpen,
  onMobileClose,
  showFullNav,
  verificationStatus,
  doctorSlug,
}: DoctorSidebarProps) {
  const pathname = usePathname();
  const [navStats, setNavStats] = useState<DoctorNavStats>({
    unreadMessages: 0,
    patients: 0,
    pendingRequests: 0,
    sundayQueue: 0,
    homeVisits: 0,
  });

  useEffect(() => {
    if (!showFullNav) return;

    let cancelled = false;

    const refresh = async () => {
      const [unreadMessages, summaryRes] = await Promise.all([
        fetchThreads()
          .then((threads) =>
            threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0),
          )
          .catch(() => 0),
        fetch("/api/v1/doctor/summary")
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ]);

      if (cancelled) return;

      const summary = summaryRes?.success
        ? (summaryRes.data as DoctorDashboardSummary)
        : null;

      if (summary) {
        setNavStats(summaryToNavStats(summary, unreadMessages));
      } else {
        setNavStats((prev) => ({ ...prev, unreadMessages }));
      }
    };

    void refresh();

    const onFocus = () => {
      void refresh();
    };

    const onChatUnread = (event: Event) => {
      const total = (event as CustomEvent<{ total: number }>).detail?.total;
      if (typeof total === "number") {
        setNavStats((prev) => ({ ...prev, unreadMessages: total }));
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(CHAT_UNREAD_EVENT, onChatUnread);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CHAT_UNREAD_EVENT, onChatUnread);
    };
  }, [showFullNav, pathname]);

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
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          Dr
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{siteConfig.name}</p>
          <p className="truncate text-xs text-slate-400">Doctor workspace</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {section.title}
            </p>
            <div className="space-y-1">
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
                      "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      active
                        ? "bg-brand text-white shadow-sm"
                        : "text-slate-300 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "opacity-100" : "opacity-80",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        {badge !== null && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              active ? "bg-white/20" : "bg-white/10 text-slate-200",
                            )}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-snug",
                          active ? "text-white/80" : "text-slate-500 group-hover:text-slate-400",
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "mt-1 h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60",
                        active && "opacity-70",
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
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Application
            </p>
            <Link
              href="/doctor/verification"
              onClick={onMobileClose}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                pathname.startsWith("/doctor/verification")
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">Resubmit application</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Update credentials and documents
                </span>
              </span>
            </Link>
          </div>
        )}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-4">
        {publicProfileHref && (
          <Link
            href={publicProfileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View public profile
          </Link>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
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
          "fixed bottom-0 left-0 z-50 flex w-[17.5rem] flex-col bg-slate-900 transition-transform duration-200 lg:translate-x-0",
          workspaceSidebarTop,
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
