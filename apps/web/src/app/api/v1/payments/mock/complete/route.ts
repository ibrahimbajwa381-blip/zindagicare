import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDummyPaymentMode } from "@/lib/payments/dummy-payment";
import {
  completeTestPayment,
  failPayment,
  paymentFailedPath,
  paymentSuccessPath,
} from "@/lib/payments/payment-router";

/** @deprecated Use POST /api/v1/payments/test/complete — kept for old links */
export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId || !isDummyPaymentMode()) {
    return NextResponse.redirect(new URL("/doctors/booking/failed", req.nextUrl.origin));
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent(`/doctors/booking/pay?paymentId=${paymentId}`)}`,
        req.nextUrl.origin,
      ),
    );
  }

  try {
    await completeTestPayment(paymentId, session.user.id);
    return NextResponse.redirect(
      new URL(await paymentSuccessPath(paymentId), req.nextUrl.origin),
    );
  } catch {
    await failPayment(paymentId, "mock_complete_failed");
    return NextResponse.redirect(
      new URL(await paymentFailedPath(paymentId), req.nextUrl.origin),
    );
  }
}
