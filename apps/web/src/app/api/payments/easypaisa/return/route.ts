import { NextRequest, NextResponse } from "next/server";
import { PaymentProviders } from "@zindagi/shared";
import { easypaisaCallbackSchema } from "@zindagi/validators";
import {
  isEasypaisaSuccess,
  parseCallbackFields,
} from "@/lib/payments/easypaisa";
import {
  completePaymentAfterGateway,
  failPayment,
  paymentFailedPath,
  paymentSuccessPath,
  resolvePaymentIdFromGatewayCallback,
} from "@/lib/payments/payment-router";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const SANDBOX_CONFIRM_URL = "https://easypaystg.easypaisa.com.pk/easypay/Confirm.jsf";
const PRODUCTION_CONFIRM_URL = "https://easypay.easypaisa.com.pk/easypay/Confirm.jsf";

async function parseRequestFields(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return parseCallbackFields(await req.json());
  }

  if (req.method === "GET") {
    return parseCallbackFields(Object.fromEntries(req.nextUrl.searchParams.entries()));
  }

  const form = await req.formData();
  const raw: Record<string, unknown> = {};
  form.forEach((value, key) => {
    raw[key] = String(value);
  });
  return parseCallbackFields(raw);
}

async function confirmEasypaisaAuthToken(
  authToken: string,
  postBackUrl: string,
): Promise<Record<string, string>> {
  const sandbox = process.env.EASYPAISA_SANDBOX !== "false";
  const confirmUrl = sandbox ? SANDBOX_CONFIRM_URL : PRODUCTION_CONFIRM_URL;
  const body = new URLSearchParams({
    auth_token: authToken,
    postBackURL: postBackUrl,
  });

  const res = await fetch(confirmUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (location) {
    const url = new URL(location, confirmUrl);
    return parseCallbackFields(Object.fromEntries(url.searchParams.entries()));
  }

  const text = await res.text();
  try {
    const url = new URL(text.trim(), confirmUrl);
    return parseCallbackFields(Object.fromEntries(url.searchParams.entries()));
  } catch {
    return parseCallbackFields({ status: text });
  }
}

async function handleCallback(req: NextRequest) {
  const fields = await parseRequestFields(req);
  easypaisaCallbackSchema.parse(fields);

  const postBackUrl = `${appUrl()}/api/payments/easypaisa/return`;
  let resultFields = fields;

  if (fields.auth_token) {
    resultFields = await confirmEasypaisaAuthToken(fields.auth_token, postBackUrl);
  }

  const orderRef =
    resultFields.orderRefNumber ?? resultFields.orderRefNum ?? resultFields.orderId;
  const paymentId = await resolvePaymentIdFromGatewayCallback({
    paymentId: resultFields.ppmpf_1,
    orderRef,
    provider: PaymentProviders.EASYPAISA,
  });

  if (!paymentId) {
    return NextResponse.redirect(
      new URL("/doctors/booking/failed?reason=missing_payment", appUrl()),
    );
  }

  try {
    if (isEasypaisaSuccess(resultFields.status, resultFields.desc)) {
      await completePaymentAfterGateway(paymentId, orderRef ?? paymentId);
      return NextResponse.redirect(
        new URL(await paymentSuccessPath(paymentId), appUrl()),
      );
    }

    const reason = resultFields.desc ?? resultFields.status ?? "payment_failed";
    await failPayment(paymentId, reason);
    return NextResponse.redirect(
      new URL(await paymentFailedPath(paymentId, reason), appUrl()),
    );
  } catch {
    return NextResponse.redirect(
      new URL(await paymentFailedPath(paymentId), appUrl()),
    );
  }
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
