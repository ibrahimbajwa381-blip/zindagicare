"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/doctors", label: "Doctor verifications" },
  { href: "/admin/doctors/manage", label: "Doctor management" },
  { href: "/admin/patients", label: "Patients" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/sunday-consult", label: "Sunday consult" },
  { href: "/admin/home-visits", label: "Home care" },
  { href: "/admin/urgent-care", label: "Urgent care" },
  { href: "/admin/notifications", label: "Notifications" },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-white shadow-sm"
                : "bg-white/80 text-slate-600 hover:bg-white hover:text-brand",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
