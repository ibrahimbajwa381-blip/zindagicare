import { auth } from "@/lib/auth";
import { AppError, Roles } from "@zindagi/shared";
import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { apiError } from "@/server/api/response";
import { contentTypeFromKey } from "@/server/lib/object-storage";
import { readPayoutReceipt } from "@/server/services/payout-receipt.storage";
import {
  getPhysiotherapistPayoutReceipt,
  isOwnPhysiotherapistProfile,
} from "@/server/services/physiotherapist-finance.service";

type Params = { params: Promise<{ id: string; payoutId: string }> };

/** Serve an uploaded payout receipt to the paying admin or the receiving physiotherapist. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);

    const { id, payoutId } = await params;
    const roles = session.user.roles ?? [];
    const isAdmin = roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN);

    if (!isAdmin && !(await isOwnPhysiotherapistProfile(id, session.user.id))) {
      throw new AppError("Receipt not found", "NOT_FOUND", 404);
    }

    const { storageKey, mimeType, originalName } = await getPhysiotherapistPayoutReceipt(
      id,
      payoutId,
    );

    const buffer = unwrapEncryptedFile(await readPayoutReceipt(storageKey));
    const contentType = mimeType ?? contentTypeFromKey(storageKey);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        ...(originalName
          ? { "Content-Disposition": `inline; filename="${originalName.replace(/"/g, "")}"` }
          : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
