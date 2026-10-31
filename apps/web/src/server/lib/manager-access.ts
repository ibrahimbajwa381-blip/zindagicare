import { AppError, isManagerOnly, type Role } from "@zindagi/shared";

/**
 * Money fields a manager must never receive: payment records, refunds, earnings,
 * commission and referral (commission) markers. Payment *status* stays visible.
 */
const FINANCE_KEYS = new Set([
  "amountPkr",
  "paymentId",
  "paymentProvider",
  "paymentCurrency",
  "paymentReceipt",
  "transactionId",
  "paidAt",
  "refundedAt",
  "failureReason",
  "receiptUploaded",
  "refundMethod",
  "refundAccountTitle",
  "refundAccountNumber",
  "refundBankName",
  "totalEarnings",
  "earningsThisMonth",
  "commissionPercent",
  "commissionOverride",
  "onlineCommissionPercent",
  "homeVisitCommissionPercent",
  "effectiveOnlineCommissionPercent",
  "effectiveHomeVisitCommissionPercent",
  "isReferred",
  "referredPatientCount",
  "bankAccount",
  "payouts",
]);

function stripKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FINANCE_KEYS.has(key))
      .map(([key, v]) => [key, stripKeys(v)]),
  );
}

/** `data` as the client would see it (JSON), minus finance fields — for responses sent to a manager. */
export function redactFinance<T>(data: T): T {
  if (data === undefined) return data;
  // JSON round-trip first so ObjectIds/Dates serialize exactly as apiSuccess would send them.
  return stripKeys(JSON.parse(JSON.stringify(data))) as T;
}

/** Managers may edit profiles but not prices or commission. */
export function assertNoFinanceWrite(body: unknown): void {
  if (body === null || typeof body !== "object") return;
  const blocked = Object.entries(body).some(
    ([key, value]) => value !== undefined && /fee|commission/i.test(key),
  );
  if (blocked) {
    throw new AppError("Managers cannot change fees or commission", "FORBIDDEN", 403);
  }
}

/** For admin routes outside withApiHandler (which does this itself): response data safe for this viewer. */
export function forPanelViewer<T>(roles: Role[] | undefined, data: T): T {
  return isManagerOnly(roles) ? redactFinance(data) : data;
}

/** For admin routes outside withApiHandler: reject a manager's fee/commission edits. */
export function assertPanelWrite(roles: Role[] | undefined, body: unknown): void {
  if (isManagerOnly(roles)) assertNoFinanceWrite(body);
}
