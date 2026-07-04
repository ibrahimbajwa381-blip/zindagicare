import { generateTxnRefNo } from "@/lib/payments/jazzcash";
import {
  getConfiguredLiveProviders,
  isLivePaymentsEnabled,
} from "@/lib/payments/payment-gateway";

/** Dummy JazzCash-shaped fields stored on Payment.metadata during MVP testing. */
export type DummyPaymentPreview = {
  provider: "dummy";
  integration: "dummy_mvp";
  txnRefNo: string;
  merchantId: string;
  amountPkr: number;
  amountPaisa: string;
  currency: string;
  billReference: string;
  description: string;
  responseCode: string;
  secureHash: string;
};

export type TestPaymentCheckout = DummyPaymentPreview & {
  completeUrl: string;
};

/**
 * MVP default: simulated payments until PAYMENTS_LIVE=true with gateway credentials.
 */
export function isDummyPaymentMode(): boolean {
  if (!isLivePaymentsEnabled()) return true;
  return getConfiguredLiveProviders().length === 0;
}

export function buildDummyPaymentPreview(params: {
  paymentId: string;
  appointmentId: string;
  amountPkr: number;
  doctorName?: string;
  description?: string;
  txnRefNo?: string;
}): DummyPaymentPreview {
  const txnRefNo = params.txnRefNo ?? `DUMMY-${generateTxnRefNo()}`;
  const amountPaisa = String(Math.round(params.amountPkr * 100));

  return {
    provider: "dummy",
    integration: "dummy_mvp",
    txnRefNo,
    merchantId: "DUMMY_MERCHANT_001",
    amountPkr: params.amountPkr,
    amountPaisa,
    currency: "PKR",
    billReference: params.appointmentId.slice(-12),
    description:
      params.description ??
      (params.doctorName
        ? `Online consult with ${params.doctorName}`
        : "ZindagiCare payment"),
    responseCode: "000",
    secureHash: "DUMMY_HASH_MVP_TESTING",
  };
}

export function buildTestPaymentCheckout(params: {
  paymentId: string;
  appointmentId: string;
  amountPkr: number;
  doctorName?: string;
  description?: string;
  txnRefNo?: string;
  payPath?: string;
}): TestPaymentCheckout {
  const preview = buildDummyPaymentPreview(params);
  return {
    ...preview,
    completeUrl: params.payPath ?? `/doctors/booking/pay?paymentId=${params.paymentId}`,
  };
}

export function dummyExternalTransactionId(txnRefNo: string): string {
  return `DUMMY-TXN-${txnRefNo}`;
}
