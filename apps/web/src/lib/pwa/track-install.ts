import { detectAppPlatform } from "@/lib/pwa/platform";

export const PWA_INSTALL_ACTION = "pwa.install";
export const PWA_INSTALL_DISMISSED_ACTION = "pwa.install_dismissed";

/** Logs the outcome of the native "Install app" prompt to the activity feed. */
export function trackPwaInstall(outcome: "accepted" | "dismissed", source: string): void {
  void fetch("/api/v1/activity/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: outcome === "accepted" ? PWA_INSTALL_ACTION : PWA_INSTALL_DISMISSED_ACTION,
      platform: "web",
      path: window.location.pathname,
      metadata: { platform: detectAppPlatform(), source },
    }),
    keepalive: true,
  }).catch(() => {});
}
