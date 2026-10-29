"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { cn } from "@zindagi/shared";
import { workspaceSidebarTop } from "@/lib/ui/surfaces";
import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";
import { ProviderAgreementGate } from "@/features/legal/components/provider-agreement-gate";
import { UnifiedHeader } from "@/components/layout/unified-header";
import {
  ChevronRight,
  Home,
  IdCard,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { siteConfig } from "@/config/site";

type NurseNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  showActiveBadge?: boolean;
};

const NURSE_APPROVED_NAV_ITEMS: NurseNavItem[] = [
  {
    href: "/nurse",
    label: "Overview",
    description: "Your workspace dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/nurse/visits",
    label: "My visits",
    description: "In-house visits assigned to you",
    icon: Home,
    showActiveBadge: true,
  },
  {
    href: "/nurse/messages",
    label: "Messages",
    description: "Chat with patients you visit",
    icon: MessageCircle,
  },
  {
    href: "/nurse/earnings",
    label: "Earnings",
    description: "Your 70% share, Sunday payouts & bank account",
    icon: Wallet,
  },
  {
    href: "/nurse/profile",
    label: "Profile",
    description: "Availability, service area & contact",
    icon: UserCog,
  },
  {
    href: "/nurse/portfolio",
    label: "Portfolio",
    description: "Your public profile & experience",
    icon: IdCard,
  },
];

const NURSE_ONBOARDING_NAV_ITEMS: NurseNavItem[] = [
  {
    href: "/nurse",
    label: "Overview",
    description: "Application status",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/nurse/verification",
    label: "Verification",
    description: "Submit credentials for admin review",
    icon: ShieldCheck,
  },
  {
    href: "/nurse/profile",
    label: "Profile",
    description: "Service area & contact details",
    icon: UserCog,
  },
  {
    href: "/nurse/portfolio",
    label: "Portfolio",
    description: "Your public profile & experience",
    icon: IdCard,
  },
];

type NurseShellProps = {
  children: ReactNode;
  showFullNav: boolean;
};

export function NurseShell({ children, showFullNav }: NurseShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeVisits, setActiveVisits] = useState(0);

  useEffect(() => {
    if (!showFullNav) return;
    fetch("/api/v1/nurse/summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setActiveVisits(json?.data?.activeVisits ?? 0))
      .catch(() => setActiveVisits(0));
  }, [pathname, showFullNav]);

  function isActive(item: NurseNavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const navItems = showFullNav ? NURSE_APPROVED_NAV_ITEMS : NURSE_ONBOARDING_NAV_ITEMS;

  const navContent = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          Rx
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{siteConfig.name}</p>
          <p className="truncate text-xs text-slate-400">Nurse workspace</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Workspace
        </p>
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const badge = item.showActiveBadge && activeVisits > 0 ? activeVisits : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
      </nav>

      <div className="border-t border-white/10 p-4">
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
    <div className="min-h-screen bg-slate-100">
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

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
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

      <div className="flex min-h-[calc(100vh-4rem)] flex-col sm:min-h-[calc(100vh-4.75rem)] lg:pl-[17.5rem]">
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[100rem]">
            <AutoBreadcrumbs variant="workspace" />
            {showFullNav && <ProviderAgreementGate role="nurse" />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
