import Constants from "expo-constants";

/**
 * EXPO_PUBLIC_API_URL must point at the apps/web dev server, e.g.
 * http://192.168.1.5:3000 (your machine's LAN IP — "localhost" does not
 * resolve from a physical device or most emulators).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";

/** API responses return media as host-relative paths (e.g. "/api/v1/public/doctor-avatars/...");
 * unlike a browser, RN's <Image> has no page origin to resolve those against. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
