import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { recordPhysiotherapistPayout } from "@/server/services/physiotherapist-finance.service";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

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
    const methodRaw = formData.get("method");
    const noteRaw = formData.get("note");
    const file = formData.get("receipt");

    if (!(file instanceof File)) {
      throw new AppError("Upload a payment receipt", "VALIDATION_ERROR", 400);
    }

    const payout = await recordPhysiotherapistPayout(session.user.id, id, {
      amount: Number(formData.get("amount")),
      method: typeof methodRaw === "string" ? methodRaw : "bank_transfer",
      note: typeof noteRaw === "string" ? noteRaw.slice(0, 500) : undefined,
      receiptFile: file,
    });
    return apiSuccess({ payout });
  } catch (error) {
    return apiError(error);
  }
}
