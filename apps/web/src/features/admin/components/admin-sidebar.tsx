"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";
import { workspaceSidebarTop } from "@/lib/ui/surfaces";
import { siteConfig } from "@/config/site";
import {
  Activity,
  Bell,
  CalendarDays,
  HeartPulse,
  Home,
  LayoutDashboard,
  Stethoscope,
  Star,
  Sun,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/admin/doctors",
    label: "Doctor verifications",
    icon: UserCheck,
  },
  {
    href: "/admin/doctors/manage",
    label: "Doctor management",
    icon: Stethoscope,
  },
  {
    href: "/admin/nurses",
    label: "Nurse verifications",
    icon: HeartPulse,
  },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/reviews", label: "Patient reviews", icon: Star },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/sunday-consult", label: "Sunday consult", icon: Sun },
  { href: "/admin/home-visits", label: "Home care", icon: Home },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

type AdminSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  function isActive(item: (typeof NAV)[number]) {
    if (item.exact) return pathname === item.href;
    if (item.href === "/admin/doctors") {
      return (
        pathname === "/admin/doctors" ||
        pathname.startsWith("/admin/doctors/review")
      );
    }
    if (item.href === "/admin/doctors/manage") {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    if (item.href === "/admin/patients") {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const navContent = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          ZC
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{siteConfig.name}</p>
          <p className="truncate text-xs text-slate-400">Operations console</p>
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Operations
        </p>
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Activity className="h-3.5 w-3.5" />
          Back to public site
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
