"use client";

import { useEffect, useState } from "react";
import type { PaymentProviderInput } from "@zindagi/validators";

type PaymentProvidersState = {
  loading: boolean;
  livePaymentsEnabled: boolean;
  providers: PaymentProviderInput[];
};

export function usePaymentProviders(): PaymentProvidersState & {
  defaultProvider: PaymentProviderInput;
} {
  const [state, setState] = useState<PaymentProvidersState>({
    loading: true,
    livePaymentsEnabled: false,
    providers: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/payments/providers");
        const json = await res.json();
        if (cancelled) return;

        if (json.success) {
          setState({
            loading: false,
            livePaymentsEnabled: Boolean(json.data?.livePaymentsEnabled),
            providers: (json.data?.providers ?? []) as PaymentProviderInput[],
          });
          return;
        }
      } catch {
        // fall through to defaults
      }

      if (!cancelled) {
        setState({
          loading: false,
          livePaymentsEnabled: false,
          providers: [],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const defaultProvider =
    state.providers.includes("jazzcash")
      ? "jazzcash"
      : state.providers.includes("easypaisa")
        ? "easypaisa"
        : "jazzcash";

  return { ...state, defaultProvider };
}

export function paymentProviderLabel(provider: PaymentProviderInput): string {
  return provider === "easypaisa" ? "Easypaisa" : "JazzCash";
}
