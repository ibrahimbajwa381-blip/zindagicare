import { NextRequest, NextResponse } from "next/server";
import {
  isJazzCashSuccess,
  parseIpnFields,
  verifySecureHash,
} from "@/lib/payments/jazzcash";
import {
  completePaymentAfterGateway,
  failPayment,
  paymentFailedPath,
  paymentSuccessPath,
} from "@/lib/payments/payment-router";
import { PaymentModel, AppointmentModel } from "@zindagi/database";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function resolveType(paymentId: string) {
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment?.appointmentId) return null;
  const appointment = await AppointmentModel.findById(payment.appointmentId).lean();
  return appointment?.type ?? null;
}

export async function GET(req: NextRequest) {
  const fields = parseIpnFields(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const paymentId = fields.ppmpf_1;

  if (!paymentId) {
    return NextResponse.redirect(new URL("/doctors/booking/failed?reason=missing_payment", appUrl()));
  }

  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT ?? "";
  if (integritySalt && fields.pp_SecureHash && !verifySecureHash(fields, integritySalt)) {
    return NextResponse.redirect(
      new URL(`/doctors/booking/failed?paymentId=${paymentId}&reason=invalid_hash`, appUrl()),
    );
  }

  const appointmentType = await resolveType(paymentId);

  try {
    if (isJazzCashSuccess(fields.pp_ResponseCode)) {
      await completePaymentAfterGateway(
        paymentId,
        fields.pp_TxnRefNo ?? fields.pp_RetreivalReferenceNo,
      );
      return NextResponse.redirect(
        new URL(paymentSuccessPath(paymentId, appointmentType), appUrl()),
      );
    }

    await failPayment(paymentId, fields.pp_ResponseMessage ?? fields.pp_ResponseCode);
    return NextResponse.redirect(
      new URL(paymentFailedPath(paymentId, appointmentType), appUrl()),
    );
  } catch {
    return NextResponse.redirect(
      new URL(paymentFailedPath(paymentId, appointmentType), appUrl()),
    );
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let fields: Record<string, string>;

  if (contentType.includes("application/json")) {
    fields = parseIpnFields(await req.json());
  } else {
    const form = await req.formData();
    const raw: Record<string, unknown> = {};
    form.forEach((value, key) => {
      raw[key] = String(value);
    });
    fields = parseIpnFields(raw);
  }

  const paymentId = fields.ppmpf_1;
  if (!paymentId) {
    return NextResponse.redirect(new URL("/doctors/booking/failed?reason=missing_payment", appUrl()));
  }

  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT ?? "";
  if (integritySalt && fields.pp_SecureHash && !verifySecureHash(fields, integritySalt)) {
    return NextResponse.redirect(
      new URL(`/doctors/booking/failed?paymentId=${paymentId}&reason=invalid_hash`, appUrl()),
    );
  }

  const appointmentType = await resolveType(paymentId);

  if (isJazzCashSuccess(fields.pp_ResponseCode)) {
    await completePaymentAfterGateway(
      paymentId,
      fields.pp_TxnRefNo ?? fields.pp_RetreivalReferenceNo,
    );
    return NextResponse.redirect(
      new URL(paymentSuccessPath(paymentId, appointmentType), appUrl()),
    );
  }

  await failPayment(paymentId, fields.pp_ResponseMessage ?? fields.pp_ResponseCode);
  return NextResponse.redirect(
    new URL(paymentFailedPath(paymentId, appointmentType), appUrl()),
  );
}
