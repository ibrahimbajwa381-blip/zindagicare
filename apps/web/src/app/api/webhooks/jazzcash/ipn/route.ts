import { NextRequest, NextResponse } from "next/server";
import { jazzcashIpnSchema } from "@zindagi/validators";
import {
  isJazzCashSuccess,
  parseIpnFields,
  verifySecureHash,
} from "@/lib/payments/jazzcash";
import {
  completePaymentAfterGateway,
  failPayment,
} from "@/lib/payments/payment-router";
import { apiError } from "@/server/api/response";

async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return req.json();
  }
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  form.forEach((value, key) => {
    out[key] = String(value);
  });
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await parseBody(req);
    const fields = parseIpnFields(raw);
    jazzcashIpnSchema.parse(fields);

    const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT ?? "";
    if (integritySalt && !verifySecureHash(fields, integritySalt)) {
      return NextResponse.json({ success: false, error: "Invalid hash" }, { status: 400 });
    }

    const paymentId = fields.ppmpf_1;
    if (!paymentId) {
      return NextResponse.json({ success: false, error: "Missing payment reference" }, { status: 400 });
    }

    if (isJazzCashSuccess(fields.pp_ResponseCode)) {
      await completePaymentAfterGateway(
        paymentId,
        fields.pp_TxnRefNo ?? fields.pp_RetreivalReferenceNo,
      );
    } else {
      await failPayment(
        paymentId,
        fields.pp_ResponseMessage ?? fields.pp_ResponseCode,
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
