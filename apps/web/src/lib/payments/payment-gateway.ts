import { PaymentProviders, type PaymentProvider } from "@zindagi/shared";
import {
  buildCheckoutForm as buildJazzCashCheckout,
  isJazzCashConfigured,
} from "@/lib/payments/jazzcash";
import {
  buildCheckoutForm as buildEasypaisaCheckout,
  isEasypaisaConfigured,
} from "@/lib/payments/easypaisa";
import type { GatewayCheckoutParams, GatewayRedirectForm } from "@/lib/payments/types";

export type { GatewayCheckoutParams, GatewayRedirectForm } from "@/lib/payments/types";

export const LIVE_PAYMENT_PROVIDERS = [
  PaymentProviders.JAZZCASH,
  PaymentProviders.EASYPAISA,
] as const;

export type LivePaymentProvider = (typeof LIVE_PAYMENT_PROVIDERS)[number];

export function isLivePaymentsEnabled(): boolean {
  return process.env.PAYMENTS_LIVE === "true" || process.env.JAZZCASH_LIVE === "true";
}

export function isGatewayConfigured(provider: PaymentProvider): boolean {
  if (provider === PaymentProviders.JAZZCASH) return isJazzCashConfigured();
  if (provider === PaymentProviders.EASYPAISA) return isEasypaisaConfigured();
  return false;
}

export function getConfiguredLiveProviders(): LivePaymentProvider[] {
  return LIVE_PAYMENT_PROVIDERS.filter((provider) => isGatewayConfigured(provider));
}

export function resolveCheckoutProvider(
  requested?: PaymentProvider | string | null,
): LivePaymentProvider {
  const configured = getConfiguredLiveProviders();

  if (requested === PaymentProviders.JAZZCASH || requested === PaymentProviders.EASYPAISA) {
    if (!isGatewayConfigured(requested)) {
      throw new Error(
        requested === PaymentProviders.JAZZCASH
          ? "JazzCash credentials missing. Set JAZZCASH_* env vars."
          : "Easypaisa credentials missing. Set EASYPAISA_* env vars.",
      );
    }
    return requested;
  }

  if (configured.length === 1) return configured[0]!;
  if (configured.includes(PaymentProviders.JAZZCASH)) return PaymentProviders.JAZZCASH;
  if (configured.includes(PaymentProviders.EASYPAISA)) return PaymentProviders.EASYPAISA;

  throw new Error(
    "No payment gateway configured. Set JAZZCASH_* or EASYPAISA_* env vars, or keep PAYMENTS_LIVE unset for test payments.",
  );
}

export function buildGatewayCheckout(
  provider: LivePaymentProvider,
  params: GatewayCheckoutParams,
): GatewayRedirectForm {
  if (provider === PaymentProviders.JAZZCASH) {
    return buildJazzCashCheckout(params);
  }
  return buildEasypaisaCheckout(params);
}

export function gatewayIntegrationLabel(provider: LivePaymentProvider): string {
  if (provider === PaymentProviders.JAZZCASH) return "jazzcash_live";
  return "easypaisa_live";
}
