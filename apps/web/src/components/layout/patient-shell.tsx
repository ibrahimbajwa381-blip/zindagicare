"use client";

import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const FULLSCREEN_CHAT_PATH = "/messages";

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenChat =
    pathname === FULLSCREEN_CHAT_PATH || pathname.startsWith(`${FULLSCREEN_CHAT_PATH}/`);

  return (
    <div
      className={cn(
        "flex flex-col",
        isFullscreenChat ? "h-dvh overflow-hidden" : "min-h-full flex-1",
      )}
    >
      <SiteHeader enrichUserFromProfile />
      <main
        className={
          isFullscreenChat
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "flex-1"
        }
      >
        {children}
      </main>
      {!isFullscreenChat && <SiteFooter />}
    </div>
  );
}
