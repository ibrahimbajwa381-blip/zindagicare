import { NextResponse, type NextRequest } from "next/server";

/**
 * Short, shareable doctor link: /dr/<slug> → /doctors/<slug>. The profile page itself
 * resolves legacy slugs, canonicalizes casing, and 404s unknown doctors, so this stays a
 * pure same-origin redirect with no database lookup.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const destination = new URL(`/doctors/${encodeURIComponent(slug.trim().toLowerCase())}`, req.url);
  return NextResponse.redirect(destination, 308);
}
