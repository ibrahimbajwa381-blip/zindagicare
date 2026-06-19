import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/api/with-api-handler";
import { getPaymentStatus } from "@/lib/payments/payment-router";

type Params = { params: Promise<{ paymentId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { paymentId } = await params;

  const handler = withApiHandler(
    async ({ session }) =>
      getPaymentStatus(paymentId, session!.user!.id),
    { auth: true },
  );

  return handler(req);
}
