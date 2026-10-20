"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const TRACKED_PREFIXES_SKIP = ["/admin", "/api"];
const SESSION_KEY_PREFIX = "zc_pv_";
/** Set once the tab's landing page has been recorded; later views are in-app navigations. */
const ENTRY_KEY = "zc_entry";
/** Last pathname seen in this tab, so an in-app view can say which page it came from. */
const PREV_PATH_KEY = "zc_prev_path";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage unavailable (private mode).
  }
}

function detectDevice(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Where this view came from. The landing view of a tab carries the external
 * referrer host (or none = direct) plus any utm_source; later views carry the
 * previous in-app path. `document.referrer` never changes on client-side
 * navigation, so it is only meaningful for the landing view.
 */
function buildSourceMetadata(pathname: string): Record<string, string> {
  const meta: Record<string, string> = { device: detectDevice() };
  const isEntry = !readSession(ENTRY_KEY);

  if (isEntry) {
    writeSession(ENTRY_KEY, "1");
    meta.entry = "1";
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.host !== window.location.host) meta.referrer = ref.host;
      }
    } catch {
      // Malformed referrer — treat as direct.
    }
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    if (utm) meta.utmSource = utm.slice(0, 60);
  } else {
    const prev = readSession(PREV_PATH_KEY);
    if (prev && prev !== pathname) meta.fromPath = prev.slice(0, 200);
  }

  return meta;
}

/** Fires a page-view beacon per pathname per browser tab session — covers signed-in and anonymous visits. */
export function PageViewTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (!pathname) return;
    if (TRACKED_PREFIXES_SKIP.some((p) => pathname.startsWith(p))) return;

    const key = `${SESSION_KEY_PREFIX}${pathname}`;
    if (readSession(key)) {
      writeSession(PREV_PATH_KEY, pathname);
      return;
    }
    const metadata = buildSourceMetadata(pathname);
    writeSession(PREV_PATH_KEY, pathname);
    writeSession(key, "1");

    void fetch("/api/v1/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "page.view",
        path: pathname,
        platform: "web",
        metadata,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, session?.user?.id]);

  return null;
}
