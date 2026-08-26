import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import { AppError, isAdmin } from "@zindagi/shared";
import {
  contentTypeFromKey,
  getObject,
  validateStorageKey,
} from "@/server/lib/object-storage";
import { getHerbalistPayoutReceiptStorageKey } from "@/server/services/admin-herbalist-finance.service";

type Params = { params: Promise<{ id: string; payoutId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdmin(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id, payoutId } = await params;
    const { storageKey, mimeType } = await getHerbalistPayoutReceiptStorageKey(
      id,
      payoutId,
    );
    validateStorageKey(storageKey);
    const buffer = await getObject("payout-receipts", storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType ?? contentTypeFromKey(storageKey),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
