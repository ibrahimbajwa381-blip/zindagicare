"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import {
  ADMIN_REVIEWS_ROOT,
  ADMIN_REVIEW_CATEGORY_LIST,
} from "@/features/admin/lib/admin-review-categories";
import { ADMIN_NAV_COUNTS_EVENT } from "@/features/admin/lib/nav-counts-events";
import type { AdminNavCounts } from "@/features/admin/types/admin-nav";
import {
  ADMIN_HOME_VISITS_ROOT,
  ADMIN_HOME_VISIT_PROVIDER_LIST,
} from "@/features/home-care/lib/admin-home-visit-providers";
import { HomeVisitProviderKinds, type HomeVisitProviderKind } from "@zindagi/shared";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  Home,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  Star,
  Sun,
  UserCheck,
  Users,
  X,
  BarChart3,
  Wallet,
} from "lucide-react";

type AdminNavCountKey = keyof AdminNavCounts;

type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  countKey?: AdminNavCountKey;
  /** Sub-pages listed beneath this item; its badge shows their combined count. */
  children?: AdminNavItem[];
};

const HOME_VISIT_PROVIDER_ICONS: Record<HomeVisitProviderKind, LucideIcon> = {
  [HomeVisitProviderKinds.DOCTOR]: Stethoscope,
  [HomeVisitProviderKinds.PHYSIOTHERAPIST]: Activity,
  [HomeVisitProviderKinds.NURSE]: HeartPulse,
};

type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

const NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Operations",
    items: [
      {
        href: "/admin/appointments",
        label: "Appointments",
        description: "Schedule and reassign visits",
        icon: CalendarDays,
      },
      {
        href: "/admin/finances",
        label: "Finances",
        description: "Payments and payouts",
        icon: Banknote,
      },
      {
        href: "/admin/platform-earnings",
        label: "ZindagiCare earnings",
        description: "Commission earned per doctor",
        icon: Wallet,
        exact: true,
      },
      {
        href: "/admin/sunday-consult",
        label: "Sunday consult",
        description: "Free Sunday consult queue",
        icon: Sun,
        countKey: "sundayConsult",
      },
      {
        href: "/admin/urgent-care",
        label: "Urgent care",
        description: "Assign urgent video consults",
        icon: Activity,
        countKey: "urgentCare",
      },
      {
        href: ADMIN_HOME_VISITS_ROOT,
        label: "Home visits",
        description: "In-home visit requests",
        icon: Home,
        children: ADMIN_HOME_VISIT_PROVIDER_LIST.map((provider) => ({
          href: provider.href,
          label: provider.navLabel,
          description: provider.navDescription,
          icon: HOME_VISIT_PROVIDER_ICONS[provider.kind],
          countKey: provider.navCountKey,
        })),
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        description: "System alerts and broadcasts",
        icon: Bell,
      },
    ],
  },
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Overview",
        description: "Platform health and queues",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/admin/doctor-stats",
        label: "Doctor statistics",
        description: "Specialty, city, and coverage stats",
        icon: BarChart3,
        exact: true,
      },
      {
        href: "/admin/patient-stats",
        label: "Patient statistics",
        description: "Demographics, growth, and activity",
        icon: Users,
        exact: true,
      },
      {
        href: "/admin/users",
        label: "User analytics",
        description: "All accounts — growth, roles, cities, ages",
        icon: BarChart3,
        exact: true,
      },
      {
        href: "/admin/activity",
        label: "Activity log",
        description: "Feature usage and friction across patients & doctors",
        icon: Activity,
        exact: true,
      },
      {
        href: "/admin/admin-activity",
        label: "Admin activity",
        description: "Audit trail of admin actions",
        icon: ShieldCheck,
        exact: true,
      },
    ],
  },
  {
    title: "Verifications",
    items: [
      {
        href: "/admin/doctors",
        label: "Doctor verifications",
        description: "Review pending doctor applications",
        icon: UserCheck,
        countKey: "doctors",
      },
      {
        href: "/admin/nurses",
        label: "Nurse verifications",
        description: "Review pending nurse applications",
        icon: HeartPulse,
        countKey: "nurses",
      },
      {
        href: "/admin/physiotherapists",
        label: "Physiotherapist verifications",
        description: "Review pending physio applications",
        icon: Activity,
        countKey: "physiotherapists",
      },
    ],
  },
  {
    title: "Directory",
    items: [
      {
        href: "/admin/doctors/manage",
        label: "Doctor management",
        description: "Manage approved doctors",
        icon: Stethoscope,
      },
      {
        href: "/admin/physiotherapists/manage",
        label: "Physiotherapist management",
        description: "Manage approved physiotherapists",
        icon: Activity,
      },
      {
        href: "/admin/patients",
        label: "Patients",
        description: "Patient accounts and activity",
        icon: Users,
      },
      {
        href: "/admin/admins",
        label: "Admin users",
        description: "Operations team access",
        icon: ShieldCheck,
      },
      {
        href: ADMIN_REVIEWS_ROOT,
        label: "Reviews",
        description: "Moderate patient and platform reviews",
        icon: Star,
        children: ADMIN_REVIEW_CATEGORY_LIST.map((category) => ({
          href: category.href,
          label: category.navLabel,
          description: category.navDescription,
          icon: category.icon,
          countKey: category.navCountKey,
        })),
      },
    ],
  },
];

const NAV_POLL_MS = 30_000;

function NavCountBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
        active
          ? "bg-white/25 text-white"
          : "bg-brand/90 text-white shadow-sm shadow-brand/30",
      )}
      aria-label={`${label} pending`}
    >
      {label}
    </span>
  );
}

type AdminSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<AdminNavCounts | null>(null);
  /** Explicit open/closed per group; unset groups default to open when a child page is active. */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const loadCounts = useCallback(async () => {
    const res = await fetch("/api/v1/admin/nav-counts");
    const json = await res.json();
    if (json.success) {
      setCounts(json.data as AdminNavCounts);
    }
  }, []);

  useEffect(() => {
    void loadCounts();
    const interval = setInterval(loadCounts, NAV_POLL_MS);

    const onRefresh = () => {
      void loadCounts();
    };
    const onFocus = () => {
      void loadCounts();
    };

    window.addEventListener(ADMIN_NAV_COUNTS_EVENT, onRefresh);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener(ADMIN_NAV_COUNTS_EVENT, onRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCounts]);

  useEffect(() => {
    void loadCounts();
  }, [pathname, loadCounts]);

  function itemCount(item: AdminNavItem): number {
    if (!counts) return 0;
    if (item.children) {
      return item.children.reduce((sum, child) => sum + itemCount(child), 0);
    }
    return item.countKey ? counts[item.countKey] : 0;
  }

  function isActive(item: AdminNavItem): boolean {
    if (item.exact) return pathname === item.href;
    if (item.href === "/admin/doctors") {
      return (
        pathname === "/admin/doctors" ||
        pathname.startsWith("/admin/doctors/review")
      );
    }
    if (item.href === "/admin/physiotherapists") {
      return (
        pathname === "/admin/physiotherapists" ||
        pathname.startsWith("/admin/physiotherapists/review")
      );
    }
    if (item.href === "/admin/doctors/manage") {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    if (item.href === "/admin/patients") {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    if (item.href === "/admin/admins") {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function renderNavItem(item: AdminNavItem) {
    if (item.children) return renderNavGroup(item);

    const active = isActive(item);
    const Icon = item.icon;
    const count = itemCount(item);

    return (
      <div key={item.href}>
        <Link
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
              <span className="text-sm font-medium leading-none">{item.label}</span>
              <NavCountBadge count={count} active={active} />
            </span>
            <span
              className={cn(
                "mt-1 block text-[11px] leading-snug",
                active ? "text-white/75" : "text-slate-500 group-hover:text-slate-400",
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
      </div>
    );
  }

  /** Parent row toggles its sub-pages open/closed instead of navigating. */
  function renderNavGroup(item: AdminNavItem) {
    const children = item.children ?? [];
    const childActive = children.some(isActive);
    const open = openGroups[item.href] ?? childActive;
    const Icon = item.icon;
    const count = itemCount(item);
    const panelId = `admin-nav-group-${item.href.replace(/\W+/g, "-")}`;

    return (
      <div key={item.href}>
        <button
          type="button"
          onClick={() => setOpenGroups((prev) => ({ ...prev, [item.href]: !open }))}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "group relative flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-200",
            childActive && !open
              ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-md shadow-brand/20"
              : open
                ? "bg-white/[0.04] text-white"
                : "text-slate-300 hover:bg-white/6 hover:text-white",
          )}
        >
          {childActive && (
            <span
              className={cn(
                "absolute inset-y-2 left-0 w-0.5 rounded-full",
                open ? "bg-brand" : "bg-white/70",
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              childActive && !open
                ? "bg-white/15 text-white"
                : open
                  ? "bg-brand/20 text-brand"
                  : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 py-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium leading-none">{item.label}</span>
              {!open && <NavCountBadge count={count} active={childActive} />}
            </span>
            <span
              className={cn(
                "mt-1 block text-[11px] leading-snug",
                childActive && !open ? "text-white/75" : "text-slate-500 group-hover:text-slate-400",
              )}
            >
              {item.description}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-2 h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out",
              open ? "rotate-180 text-slate-300" : "text-slate-500 group-hover:text-slate-300",
              childActive && !open && "text-white/70",
            )}
          />
        </button>

        <div
          id={panelId}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!open}
        >
          <div className="overflow-hidden">
            <div className="mt-1 ml-[1.625rem] space-y-0.5 border-l border-white/10 pl-2.5">
              {children.map((child, index) => (
                <div
                  key={child.href}
                  className={cn(
                    "transition-all duration-300 ease-out",
                    open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
                  )}
                  style={{ transitionDelay: open ? `${60 + index * 50}ms` : "0ms" }}
                >
                  {renderSubNavItem(child, !open)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSubNavItem(item: AdminNavItem, hidden = false) {
    const active = isActive(item);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onMobileClose}
        tabIndex={hidden ? -1 : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
          active
            ? "bg-white/10 font-medium text-white"
            : "text-slate-400 hover:bg-white/6 hover:text-white",
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-slate-500")} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <NavCountBadge count={itemCount(item)} active={false} />
      </Link>
    );
  }

  const navContent = (
    <>
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5 sm:h-[4.75rem]">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
          aria-hidden
        />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-lg shadow-brand/30 ring-2 ring-white/15">
          ZC
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {siteConfig.name}
          </p>
          <p className="truncate text-xs text-slate-400">Operations console</p>
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
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2.5 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                {section.title}
                <span className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => renderNavItem(item))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-white/8 bg-black/15 px-3 py-3">
        <Link
          href="/"
          prefetch={false}
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
