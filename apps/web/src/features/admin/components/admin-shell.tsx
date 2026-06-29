"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { cn } from "@zindagi/shared";
import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";
import { UnifiedHeader } from "@/components/layout/unified-header";
import { AdminSidebar } from "./admin-sidebar";

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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

      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className={cn("flex min-h-[calc(100vh-4rem)] flex-col sm:min-h-[calc(100vh-4.75rem)] lg:pl-[17.5rem]")}>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[100rem]">
            <AutoBreadcrumbs variant="workspace" />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
