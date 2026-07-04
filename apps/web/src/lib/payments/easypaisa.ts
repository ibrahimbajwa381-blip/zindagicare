import { createCipheriv } from "crypto";
import type { GatewayCheckoutParams, GatewayRedirectForm } from "@/lib/payments/types";

const SANDBOX_CHECKOUT_URL = "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf";
const PRODUCTION_CHECKOUT_URL = "https://easypay.easypaisa.com.pk/easypay/Index.jsf";

/** Hosted MA wallet redirect (POST to /tpg). */
const SANDBOX_TPG_URL = "https://easypaystg.easypaisa.com.pk/tpg";
const PRODUCTION_TPG_URL = "https://easypay.easypaisa.com.pk/tpg";

export type EasypaisaConfig = {
  storeId: string;
  hashKey: string;
  postBackUrl: string;
  sandbox: boolean;
};

function getConfig(): EasypaisaConfig {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    storeId: process.env.EASYPAISA_STORE_ID ?? "",
    hashKey: process.env.EASYPAISA_HASH_KEY ?? "",
    postBackUrl: `${appUrl}/api/payments/easypaisa/return`,
    sandbox: process.env.EASYPAISA_SANDBOX !== "false",
  };
}

export function isEasypaisaConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.storeId && cfg.hashKey);
}

function formatKarachiTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatAmount(amountPkr: number): string {
  return amountPkr.toFixed(1);
}

function aesEncryptEcb(plainText: string, hashKey: string): string {
  const key = Buffer.alloc(16, 0);
  Buffer.from(hashKey, "utf8").copy(key, 0, 0, 16);
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]).toString("base64");
}

function buildEncryptedHashRequest(params: {
  amount: string;
  orderRefNum: string;
  postBackURL: string;
  storeId: string;
  timeStamp: string;
  hashKey: string;
}): string {
  const query =
    `amount=${params.amount}` +
    `&orderRefNum=${params.orderRefNum}` +
    `&paymentMethod=InitialRequest` +
    `&postBackURL=${params.postBackURL}` +
    `&storeId=${params.storeId}` +
    `&timeStamp=${params.timeStamp}`;

  return aesEncryptEcb(query, params.hashKey);
}

export function buildCheckoutForm(params: GatewayCheckoutParams): GatewayRedirectForm {
  const cfg = getConfig();
  const amount = formatAmount(params.amountPkr);
  const orderRefNum = params.txnRefNo.slice(0, 20);
  const timeStamp = formatKarachiTimestamp();
  const encryptedHashRequest = buildEncryptedHashRequest({
    amount,
    orderRefNum,
    postBackURL: cfg.postBackUrl,
    storeId: cfg.storeId,
    timeStamp,
    hashKey: cfg.hashKey,
  });

  const actionUrl = cfg.sandbox ? SANDBOX_TPG_URL : PRODUCTION_TPG_URL;

  return {
    actionUrl,
    fields: {
      storeId: cfg.storeId,
      orderId: orderRefNum,
      transactionAmount: amount,
      mobileAccountNo: params.customerMobile ?? "",
      emailAddress: params.customerEmail ?? "",
      transactionType: "InitialRequest",
      tokenExpiry: "",
      bankIdentificationNumber: "",
      encryptedHashRequest,
      merchantPaymentMethod: "",
      postBackURL: cfg.postBackUrl,
      signature: "",
      ppmpf_1: params.paymentId,
    },
  };
}

/** CC redirect flow (Index.jsf) — kept for merchants with card checkout enabled. */
export function buildCardCheckoutForm(params: GatewayCheckoutParams): GatewayRedirectForm {
  const cfg = getConfig();
  const amount = formatAmount(params.amountPkr);
  const orderRefNum = params.txnRefNo.slice(0, 20);

  const hashFields: Record<string, string> = {
    amount,
    autoRedirect: "1",
    emailAddr: params.customerEmail ?? "",
    mobileNum: params.customerMobile ?? "",
    orderRefNum,
    paymentMethod: "CC_PAYMENT_METHOD",
    postBackURL: cfg.postBackUrl,
    storeId: cfg.storeId,
  };

  const sortedKeys = Object.keys(hashFields).sort();
  const hashString = sortedKeys.map((key) => `${key}=${hashFields[key]}`).join("&");
  const merchantHashedReq = aesEncryptEcb(hashString, cfg.hashKey);

  const actionUrl = cfg.sandbox ? SANDBOX_CHECKOUT_URL : PRODUCTION_CHECKOUT_URL;

  return {
    actionUrl,
    fields: {
      amount,
      storeId: cfg.storeId,
      postBackURL: cfg.postBackUrl,
      orderRefNum,
      merchantHashedReq,
      paymentMethod: "CC_PAYMENT_METHOD",
      autoRedirect: "1",
      emailAddr: params.customerEmail ?? "",
      mobileNum: params.customerMobile ?? "",
      ppmpf_1: params.paymentId,
    },
  };
}

export function parseCallbackFields(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return out;
}

export function isEasypaisaSuccess(status: string | undefined, desc?: string): boolean {
  if (!status) return desc === "0000";
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "paid") return true;
  return desc === "0000";
}
