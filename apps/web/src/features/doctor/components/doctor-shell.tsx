"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorAvatar } from "@/features/doctor/components/doctor-avatar";
import { DoctorSidebar } from "@/features/doctor/components/doctor-sidebar";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";

type DoctorShellProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  showFullNav: boolean;
  verificationStatus?: string | null;
  doctorSlug?: string | null;
};

export function DoctorShell({
  children,
  user,
  showFullNav,
  verificationStatus,
  doctorSlug,
}: DoctorShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user.name ?? "Doctor";
  const avatarSrc = resolveDoctorPortrait(displayName, user.avatarUrl);

  return (
    <div className="min-h-screen bg-slate-100">
      <DoctorSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        showFullNav={showFullNav}
        verificationStatus={verificationStatus}
        doctorSlug={doctorSlug}
      />

      <div className="flex min-h-screen flex-col lg:pl-[17.5rem]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Doctor workspace
              </p>
              <p className="text-sm font-semibold text-slate-900">Dr. {displayName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">Dr. {displayName}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <DoctorAvatar name={displayName} avatarUrl={avatarSrc} size="sm" />
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/">Public site</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[100rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
