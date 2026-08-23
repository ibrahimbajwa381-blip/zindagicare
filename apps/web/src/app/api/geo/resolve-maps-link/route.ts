import { NextRequest, NextResponse } from "next/server";
import { parseGoogleMapsUrl } from "@/lib/geo/parse-google-maps-url";

const MAX_REDIRECTS = 8;

/**
 * Short Google Maps links (maps.app.goo.gl, goo.gl/maps) carry no coordinates
 * in the URL itself — they only reveal them after the server redirect chain
 * resolves to the full google.com/maps URL. Browsers can't follow that chain
 * cross-origin from client JS, so we do it here.
 */
async function resolveRedirectChain(startUrl: string): Promise<string> {
  let current = startUrl;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZindagiCareBot/1.0)" },
    });
    const location = res.headers.get("location");
    if (!location) return current;
    current = new URL(location, current).toString();
    if (!/goo\.gl|google\.com\/maps/i.test(current)) return current;
    if (/google\.com\/maps/i.test(current) && res.status >= 300 && res.status < 400) {
      continue;
    }
  }
  return current;
}

/**
 * Some /maps/place/<name>/... URLs (place listings shared from the mobile
 * app) never expose @lat,lng or !3d!4d in the URL itself. Google still
 * renders a static-map preview image on the page pointed at the place's
 * coordinates (center=lat,lng), so we can pull the coordinates back out of
 * the HTML without needing any API key.
 */
async function extractCoordsFromPage(url: string): Promise<{ lng: number; lat: number } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZindagiCareBot/1.0)" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(
    /staticmap\?center(?:=|\\u003d)(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/,
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function GET(req: NextRequest) {
  const link = req.nextUrl.searchParams.get("url");
  if (!link) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol) || !/(^|\.)google\.com$|(^|\.)goo\.gl$/i.test(parsed.hostname)) {
    return NextResponse.json({ error: "Unsupported host" }, { status: 400 });
  }

  try {
    const resolvedUrl = await resolveRedirectChain(parsed.toString());
    const coords = parseGoogleMapsUrl(resolvedUrl);
    if (coords) return NextResponse.json(coords);

    const fromPage = await extractCoordsFromPage(resolvedUrl);
    if (fromPage) return NextResponse.json(fromPage);

    return NextResponse.json({ error: "Could not extract coordinates" }, { status: 422 });
  } catch {
    return NextResponse.json({ error: "Could not resolve link" }, { status: 502 });
  }
}
