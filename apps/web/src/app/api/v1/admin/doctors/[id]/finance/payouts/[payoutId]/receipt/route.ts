import { auth } from "@/lib/auth";
import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import { AppError, Roles } from "@zindagi/shared";
import { apiError } from "@/server/api/response";
import { getDoctorPayoutReceiptStorageKey } from "@/server/services/admin-doctor-finance.service";
import { readPayoutReceipt } from "@/server/services/payout-receipt.storage";
import { contentTypeFromKey } from "@/server/lib/object-storage";
import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";

type Params = { params: Promise<{ id: string; payoutId: string }> };

/** Serve an uploaded payout receipt for the paying admin or the receiving doctor. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);

    const { id, payoutId } = await params;
    const roles = session.user.roles ?? [];
    const isAdmin = roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN);

    if (!isAdmin) {
      await connectDatabase();
      const profile = await DoctorProfileModel.findById(id).select("userId").lean();
      const isOwner = profile?.userId?.toString() === session.user.id;
      if (!isOwner) {
        throw new AppError("Receipt not found", "NOT_FOUND", 404);
      }
    }

    const { storageKey, mimeType, originalName } = await getDoctorPayoutReceiptStorageKey(
      id,
      payoutId,
    );

    const encrypted = await readPayoutReceipt(storageKey);
    const buffer = unwrapEncryptedFile(encrypted);
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
