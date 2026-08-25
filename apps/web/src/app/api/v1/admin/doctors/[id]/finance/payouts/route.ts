import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { recordDoctorPayout } from "@/server/services/admin-doctor-finance.service";
import { savePayoutReceipt } from "@/server/services/payout-receipt.storage";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

const PAYOUT_METHODS = ["bank_transfer", "jazzcash", "easypaisa", "cash", "other"];

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const formData = await req.formData();
    const amount = Number(formData.get("amount"));
    const method =
      typeof formData.get("method") === "string" ? String(formData.get("method")) : "bank_transfer";
    const noteRaw = formData.get("note");
    const note = typeof noteRaw === "string" ? noteRaw : undefined;
    const file = formData.get("receipt");

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Enter a valid payout amount", "VALIDATION_ERROR", 400);
    }
    if (!PAYOUT_METHODS.includes(method)) {
      throw new AppError("Invalid payout method", "VALIDATION_ERROR", 400);
    }
    if (!(file instanceof File)) {
      throw new AppError("Upload a payment receipt", "VALIDATION_ERROR", 400);
    }

    const payoutId = new Types.ObjectId();
    const receipt = await savePayoutReceipt(id, payoutId.toString(), file);

    const payout = await recordDoctorPayout(session.user.id, id, {
      _id: payoutId,
      amount,
      method,
      note,
      receipt,
    });
    return apiSuccess({ payout });
  } catch (error) {
    return apiError(error);
  }
}
