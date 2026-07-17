import { siteConfig } from "@/config/site";
import {
  getConfiguredLiveProviders,
  isLivePaymentsEnabled,
} from "@/lib/payments/payment-gateway";

export type JazzCashAccountDetails = {
  number: string;
  numberDisplay: string;
  accountTitle: string;
};

export type ManualTransferCheckout = {
  provider: "manual_jazzcash";
  integration: "manual_jazzcash";
  payUrl: string;
  amountPkr: number;
  currency: "PKR";
  account: JazzCashAccountDetails;
  description: string;
};

/**
 * Manual JazzCash transfer is the default until live gateway credentials are enabled.
 */
export function isManualTransferMode(): boolean {
  if (!isLivePaymentsEnabled()) return true;
  return getConfiguredLiveProviders().length === 0;
}

export function getJazzCashAccountDetails(): JazzCashAccountDetails {
  return {
    number: siteConfig.jazzCash.number,
    numberDisplay: siteConfig.jazzCash.numberDisplay,
    accountTitle: siteConfig.jazzCash.accountTitle,
  };
}

export function buildManualTransferCheckout(params: {
  paymentId: string;
  amountPkr: number;
  description?: string;
  payPath?: string;
}): ManualTransferCheckout {
  return {
    provider: "manual_jazzcash",
    integration: "manual_jazzcash",
    payUrl: params.payPath ?? `/doctors/booking/pay?paymentId=${params.paymentId}`,
    amountPkr: params.amountPkr,
    currency: "PKR",
    account: getJazzCashAccountDetails(),
    description: params.description ?? "ZindagiCare payment",
  };
}

export function manualExternalTransactionId(paymentId: string): string {
  return `MANUAL-JAZZCASH-${paymentId}`;
}
