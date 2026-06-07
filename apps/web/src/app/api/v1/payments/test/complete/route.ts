import { withApiHandler } from "@/server/api/with-api-handler";
import { AppError, ErrorCodes } from "@zindagi/shared";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { isDummyPaymentMode } from "@/lib/payments/dummy-payment";

export const POST = withApiHandler(
  async ({ session, req }) => {
    const paymentId =
      req.nextUrl.searchParams.get("paymentId") ??
      (await req.json().catch(() => ({}))).paymentId;

    if (!paymentId || typeof paymentId !== "string") {
      throw new AppError("paymentId required", ErrorCodes.VALIDATION, 400);
    }

    if (!isDummyPaymentMode()) {
      throw new AppError(
        "Test payments are disabled when JAZZCASH_LIVE=true",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    return OnlineConsultService.completeTestPayment(paymentId, session!.user!.id);
  },
  { auth: true },
);
