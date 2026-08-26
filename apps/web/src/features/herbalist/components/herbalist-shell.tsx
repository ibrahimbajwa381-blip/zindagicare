"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { cn } from "@zindagi/shared";
import { AutoBreadcrumbs } from "@/components/layout/auto-breadcrumbs";
import { SiteFooter } from "@/components/layout/site-footer";
import { UnifiedHeader } from "@/components/layout/unified-header";
import { HerbalistMobilePracticeNav } from "@/features/herbalist/components/herbalist-mobile-practice-nav";
import { HerbalistSidebar } from "@/features/herbalist/components/herbalist-sidebar";
import { ProviderAgreementGate } from "@/features/legal/components/provider-agreement-gate";

type HerbalistShellProps = {
  children: ReactNode;
  showFullNav: boolean;
  verificationStatus?: string | null;
  herbalistName?: string;
  herbalistAvatarUrl?: string | null;
};

export function HerbalistShell({
  children,
  showFullNav,
  verificationStatus,
  herbalistName = "Herbalist",
  herbalistAvatarUrl,
}: HerbalistShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const showPracticeNav = showFullNav;

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

      <HerbalistSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        showFullNav={showFullNav}
        verificationStatus={verificationStatus}
        herbalistName={herbalistName}
        herbalistAvatarUrl={herbalistAvatarUrl}
      />

      <div className="flex min-h-[calc(100vh-4rem)] flex-col sm:min-h-[calc(100vh-4.75rem)] lg:pl-[17.5rem]">
        <main
          className={cn(
            "flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
            showPracticeNav &&
              "max-lg:pb-[calc(4.75rem+env(safe-area-inset-bottom))]",
          )}
        >
          <div className="mx-auto w-full max-w-[100rem]">
            <AutoBreadcrumbs variant="workspace" />
            {showFullNav && <ProviderAgreementGate role="herbalist" />}
            {children}
          </div>
        </main>
        <SiteFooter />
        {showPracticeNav ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <HerbalistMobilePracticeNav />
          </div>
        ) : null}
      </div>
    </div>
  );
}
