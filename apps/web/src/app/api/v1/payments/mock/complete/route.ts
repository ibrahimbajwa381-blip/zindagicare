import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDummyPaymentMode } from "@/lib/payments/dummy-payment";
import {
  completePaymentAfterGateway,
  completeTestPayment,
  failPayment,
  paymentFailedPath,
  paymentSuccessPath,
} from "@/lib/payments/payment-router";
import { PaymentModel, AppointmentModel } from "@zindagi/database";

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
    await completeTestPayment(paymentId, session.user.id);
    const payment = await PaymentModel.findById(paymentId).lean();
    const appointment = payment?.appointmentId
      ? await AppointmentModel.findById(payment.appointmentId).lean()
      : null;
    return NextResponse.redirect(
      new URL(paymentSuccessPath(paymentId, appointment?.type ?? null), req.nextUrl.origin),
    );
  } catch {
    const payment = await PaymentModel.findById(paymentId).lean();
    const appointment = payment?.appointmentId
      ? await AppointmentModel.findById(payment.appointmentId).lean()
      : null;
    return NextResponse.redirect(
      new URL(paymentFailedPath(paymentId, appointment?.type ?? null), req.nextUrl.origin),
    );
  }
}
