import { headers } from "next/headers";

export type RequestGeo = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
};

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value).trim() || undefined;
  } catch {
    return value.trim() || undefined;
  }
}

/**
 * Best-effort client IP + coarse location for the current request.
 *
 * Location comes from the edge network's IP geolocation headers (Vercel's
 * `x-vercel-ip-*`, with Cloudflare's `cf-ip*` as a fallback) so no third-party
 * lookup is needed. Returns `{}` outside a request scope (scripts, cron jobs)
 * or when running locally without those headers.
 */
export async function getRequestGeo(): Promise<RequestGeo> {
  try {
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwardedFor || h.get("x-real-ip")?.trim() || undefined;

    return {
      ip,
      city: decodeHeader(h.get("x-vercel-ip-city") ?? h.get("cf-ipcity")),
      region: decodeHeader(h.get("x-vercel-ip-country-region") ?? h.get("cf-region")),
      country: decodeHeader(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry")),
    };
  } catch {
    return {};
  }
}
