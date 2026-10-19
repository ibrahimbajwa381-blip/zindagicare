import { z } from "zod";
import { unwrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { AppError, isAdmin } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { contentTypeFromKey, validateStorageKey } from "@/server/lib/object-storage";
import { readPayoutReceipt } from "@/server/services/payout-receipt.storage";

/**
 * Route-handler factories for provider payouts that share the DoctorPayout
 * ledger (herbalists, nutritionists). Each role supplies its own service
 * functions; auth, multipart parsing and receipt streaming live here once.
 */

type Params = { params: Promise<{ id: string }> };
type ReceiptParams = { params: Promise<{ id: string; payoutId: string }> };

export type RecordProviderPayout = (
  adminUserId: string,
  profileId: string,
  input: { amount: number; method: string; note?: string; receiptFile: File },
) => Promise<unknown>;

export type GetProviderPayoutReceiptKey = (
  profileId: string,
  payoutId: string,
) => Promise<{ storageKey: string; mimeType?: string; originalName?: string }>;

const payoutFieldsSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid payout amount"),
  method: z
    .enum(["bank_transfer", "jazzcash", "easypaisa", "cash", "other"])
    .default("bank_transfer"),
  note: z.string().trim().max(500).optional(),
});

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  if (!isAdmin(session.user.roles)) throw new AppError("Forbidden", "FORBIDDEN", 403);
  return session;
}

/** POST multipart/form-data: amount, method, note?, receipt (file). */
export function createAdminPayoutPostHandler(record: RecordProviderPayout) {
  return async function POST(req: Request, { params }: Params) {
    try {
      const session = await requireAdminSession();
      const { id } = await params;
      const formData = await req.formData();

      const file = formData.get("receipt");
      if (!(file instanceof File)) {
        throw new AppError("Upload a payment receipt", "VALIDATION_ERROR", 400);
      }

      const noteRaw = formData.get("note");
      const fields = payoutFieldsSchema.parse({
        amount: formData.get("amount"),
        method: formData.get("method") ?? undefined,
        note: typeof noteRaw === "string" && noteRaw.trim() ? noteRaw : undefined,
      });

      const payout = await record(session.user.id, id, { ...fields, receiptFile: file });
      return apiSuccess({ payout });
    } catch (error) {
      return apiError(error);
    }
  };
}

/** GET: stream a stored (encrypted) payout receipt back to an admin. */
export function createAdminPayoutReceiptGetHandler(getKey: GetProviderPayoutReceiptKey) {
  return async function GET(_req: Request, { params }: ReceiptParams) {
    try {
      await requireAdminSession();
      const { id, payoutId } = await params;
      const { storageKey, mimeType, originalName } = await getKey(id, payoutId);
      validateStorageKey(storageKey);

      const buffer = unwrapEncryptedFile(await readPayoutReceipt(storageKey));
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType ?? contentTypeFromKey(storageKey),
          "Cache-Control": "private, max-age=3600",
          ...(originalName
            ? { "Content-Disposition": `inline; filename="${originalName.replace(/"/g, "")}"` }
            : {}),
        },
      });
    } catch (error) {
      return apiError(error);
    }
  };
}
