import { z } from "zod";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, isAdmin } from "@zindagi/shared";
import { recordHerbalistPayout } from "@/server/services/admin-herbalist-finance.service";

type Params = { params: Promise<{ id: string }> };

const payoutSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z
    .enum(["bank_transfer", "jazzcash", "easypaisa", "cash", "other"])
    .optional(),
  note: z.string().max(500).optional(),
  receipt: z
    .object({
      storageKey: z.string().min(1),
      url: z.string().min(1),
      originalName: z.string().optional(),
      mimeType: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdmin(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = payoutSchema.parse(await req.json());
    const payout = await recordHerbalistPayout(session.user.id, id, body);
    return apiSuccess({ payout });
  } catch (error) {
    return apiError(error);
  }
}
