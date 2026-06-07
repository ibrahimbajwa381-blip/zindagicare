import { createHmac, randomBytes } from "crypto";

const SANDBOX_URL =
  "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";
const PRODUCTION_URL =
  "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";

export type JazzCashConfig = {
  merchantId: string;
  password: string;
  integritySalt: string;
  returnUrl: string;
  sandbox: boolean;
  mock: boolean;
};

export type JazzCashFormPayload = {
  actionUrl: string;
  fields: Record<string, string>;
};

function getConfig(): JazzCashConfig {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID ?? "";
  const password = process.env.JAZZCASH_PASSWORD ?? "";
  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    merchantId,
    password,
    integritySalt,
    returnUrl: `${appUrl}/api/payments/jazzcash/return`,
    sandbox: process.env.JAZZCASH_SANDBOX !== "false",
    mock: process.env.JAZZCASH_MOCK === "true",
  };
}

export function isJazzCashMockMode(): boolean {
  return getConfig().mock;
}

export function isJazzCashConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.merchantId && cfg.password && cfg.integritySalt);
}

function formatTxnDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function generateTxnRefNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `T${ts}${rand}`.slice(0, 20);
}

/** JazzCash MWPS v1.1 secure hash */
export function computeSecureHash(
  fields: Record<string, string>,
  integritySalt: string,
): string {
  const sorted = Object.keys(fields)
    .filter((key) => key.startsWith("pp_") && key !== "pp_SecureHash")
    .sort()
    .map((key) => fields[key] ?? "")
    .join("&");

  const hashString = `${integritySalt}&${sorted}`;
  return createHmac("sha256", integritySalt).update(hashString).digest("hex").toUpperCase();
}

export function verifySecureHash(
  fields: Record<string, string>,
  integritySalt: string,
): boolean {
  const received = fields.pp_SecureHash;
  if (!received) return false;
  const expected = computeSecureHash(fields, integritySalt);
  return expected === received.toUpperCase();
}

export function buildCheckoutForm(params: {
  amountPkr: number;
  txnRefNo: string;
  billReference: string;
  description: string;
  paymentId: string;
}): JazzCashFormPayload {
  const cfg = getConfig();
  const now = new Date();
  const expiry = new Date(now.getTime() + 15 * 60 * 1000);
  const amountPaisa = String(Math.round(params.amountPkr * 100));

  const fields: Record<string, string> = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: cfg.merchantId,
    pp_Password: cfg.password,
    pp_TxnRefNo: params.txnRefNo,
    pp_Amount: amountPaisa,
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: formatTxnDateTime(now),
    pp_TxnExpiryDateTime: formatTxnDateTime(expiry),
    pp_BillReference: params.billReference,
    pp_Description: params.description.slice(0, 200),
    pp_ReturnURL: cfg.returnUrl,
    ppmpf_1: params.paymentId,
  };

  fields.pp_SecureHash = computeSecureHash(fields, cfg.integritySalt);

  return {
    actionUrl: cfg.sandbox ? SANDBOX_URL : PRODUCTION_URL,
    fields,
  };
}

export function parseIpnFields(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return out;
}

export function isJazzCashSuccess(responseCode: string | undefined): boolean {
  return responseCode === "000";
}
