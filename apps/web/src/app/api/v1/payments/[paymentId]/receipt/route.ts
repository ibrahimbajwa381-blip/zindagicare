import { auth } from "@/lib/auth";
import { connectDatabase, PaymentModel } from "@zindagi/database";
import { AppError, ErrorCodes, PaymentProviders, Roles } from "@zindagi/shared";
import { apiError, apiSuccess } from "@/server/api/response";
import { submitManualPaymentReceipt } from "@/lib/payments/payment-router";
import {
  readPaymentReceipt,
  savePaymentReceipt,
} from "@/server/services/payment-receipt.storage";
import { contentTypeFromKey } from "@/server/lib/object-storage";
import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";

type Params = { params: Promise<{ paymentId: string }> };

type ReceiptMeta = {
  storageKey?: string;
  url?: string;
  originalName?: string;
  mimeType?: string;
};

async function assertCanAccessPayment(paymentId: string, userId: string, roles: string[] = []) {
  await connectDatabase();
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment) {
    throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
  }

  const isOwner = payment.userId.toString() === userId;
  const isAdmin = roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN);
  if (!isOwner && !isAdmin) {
    throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
  }

  return payment;
}

/** Upload JazzCash transfer receipt and confirm the pending manual payment. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", ErrorCodes.UNAUTHORIZED, 401);
    }

    const { paymentId } = await params;
    const payment = await assertCanAccessPayment(
      paymentId,
      session.user.id,
      session.user.roles ?? [],
    );

    if (payment.userId.toString() !== session.user.id) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }

    if (
      payment.provider !== PaymentProviders.MANUAL_JAZZCASH &&
      payment.provider !== PaymentProviders.DUMMY
    ) {
      throw new AppError("Not a manual JazzCash payment", ErrorCodes.VALIDATION, 400);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const transactionId = String(formData.get("transactionId") ?? "").trim();

    if (!(file instanceof File) && !transactionId) {
      throw new AppError(
        "Upload a receipt screenshot or enter your JazzCash TID",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const stored =
      file instanceof File
        ? await savePaymentReceipt(session.user.id, paymentId, file)
        : {
            storageKey: "",
            url: "",
            originalName: "tid-only",
            mimeType: "text/plain",
          };

    const result = await submitManualPaymentReceipt(paymentId, session.user.id, {
      ...stored,
      ...(transactionId ? { transactionId } : {}),
    });

    return apiSuccess({
      paymentId,
      receipt: stored,
      result,
    });
  } catch (error) {
    return apiError(error);
  }
}

/** Serve the uploaded receipt for the payment owner or admin. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", ErrorCodes.UNAUTHORIZED, 401);
    }

    const { paymentId } = await params;
    const payment = await assertCanAccessPayment(
      paymentId,
      session.user.id,
      session.user.roles ?? [],
    );

    const metadata = payment.metadata as { receipt?: ReceiptMeta } | undefined;
    const storageKey = metadata?.receipt?.storageKey;
    if (!storageKey) {
      throw new AppError("Receipt not found", ErrorCodes.NOT_FOUND, 404);
    }

    const encrypted = await readPaymentReceipt(storageKey);
    const buffer = unwrapEncryptedFile(encrypted);
    const contentType =
      metadata.receipt?.mimeType ?? contentTypeFromKey(storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        ...(metadata.receipt?.originalName
          ? {
              "Content-Disposition": `inline; filename="${metadata.receipt.originalName.replace(/"/g, "")}"`,
            }
          : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
