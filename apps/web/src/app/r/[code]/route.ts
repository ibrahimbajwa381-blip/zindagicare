import { NextResponse, type NextRequest } from "next/server";
import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import { mongoFilter } from "@/lib/mongo/query";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { REFERRAL_COOKIE_NAME } from "@/server/services/doctor-referral.service";

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
    return NextResponse.redirect(new URL("/", req.url));
  }

  const response = NextResponse.redirect(
    new URL(doctorProfilePath(profile.slug, profile._id.toString()), req.url),
  );
  response.cookies.set(REFERRAL_COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
