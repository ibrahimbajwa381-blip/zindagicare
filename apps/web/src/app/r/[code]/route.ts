import { NextResponse, type NextRequest } from "next/server";
import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import { mongoFilter } from "@/lib/mongo/query";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { REFERRAL_COOKIE_NAME } from "@/lib/doctors/referral-cookie";

// Never let this route (or its redirect) be cached — every hit must set a fresh cookie.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  await connectDatabase();

  const profile = await DoctorProfileModel.findOne(
    mongoFilter({ referralCode: code, isListed: true }),
  )
    .select("slug")
    .lean();

  if (!profile) {
    const response = NextResponse.redirect(new URL("/", req.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Carry the code as a query param too, as a fallback for the cookie in case the
  // redirect's Set-Cookie header is dropped by an intermediary (proxy/CDN) — middleware
  // picks it up from the query string on the landing page and (re)sets the cookie there.
  const destination = new URL(
    doctorProfilePath(profile.slug, profile._id.toString()),
    req.url,
  );
  destination.searchParams.set("ref", code);

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(REFERRAL_COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
