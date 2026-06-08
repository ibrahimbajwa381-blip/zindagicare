"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "./admin-sidebar";

type AdminShellProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export function AdminShell({ children, user }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

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
                Administration
              </p>
              <p className="text-sm font-semibold text-slate-900">Operations console</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name ?? "Admin"}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-dark">
              {(user.name ?? "A").charAt(0).toUpperCase()}
            </span>
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
