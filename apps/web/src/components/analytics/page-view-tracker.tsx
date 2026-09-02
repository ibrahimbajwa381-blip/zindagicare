"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const TRACKED_PREFIXES_SKIP = ["/admin", "/api"];
const SESSION_KEY_PREFIX = "zc_pv_";

/** Fires a page-view beacon per pathname per browser tab session — covers signed-in and anonymous visits. */
export function PageViewTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (!pathname) return;
    if (TRACKED_PREFIXES_SKIP.some((p) => pathname.startsWith(p))) return;

    const key = `${SESSION_KEY_PREFIX}${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable (private mode) — track anyway, just without de-duping.
    }

    void fetch("/api/v1/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "page.view",
        path: pathname,
        platform: "web",
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, session?.user?.id]);

  return null;
}
