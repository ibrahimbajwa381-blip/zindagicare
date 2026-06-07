import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDummyPaymentMode } from "@/lib/payments/dummy-payment";
import { OnlineConsultService } from "@/server/services/online-consult.service";

/** @deprecated Use POST /api/v1/payments/test/complete — kept for old links */
export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId || !isDummyPaymentMode()) {
    return NextResponse.redirect(new URL("/doctors/booking/failed", req.nextUrl.origin));
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(`/doctors/booking/pay?paymentId=${paymentId}`)}`, req.nextUrl.origin),
    );
  }

  try {
    await OnlineConsultService.completeTestPayment(paymentId, session.user.id);
    return NextResponse.redirect(
      new URL(`/doctors/booking/success?paymentId=${paymentId}`, req.nextUrl.origin),
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/doctors/booking/failed?paymentId=${paymentId}`, req.nextUrl.origin),
    );
  }
}
