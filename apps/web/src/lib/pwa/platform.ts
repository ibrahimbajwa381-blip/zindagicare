export type AppPlatform = "android" | "ios" | "desktop" | "unknown";

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function detectAppPlatform(): AppPlatform {
  if (isIosDevice()) return "ios";
  if (isAndroidDevice()) return "android";
  if (typeof window !== "undefined") return "desktop";
  return "unknown";
}

export function getAppInstallUrl(platform?: AppPlatform): string {
  const base = "/get-app";
  if (platform === "android" || platform === "ios") {
    return `${base}?platform=${platform}`;
  }
  return base;
}

export function getShareableAppUrl(origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/get-app`;
}
