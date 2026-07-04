export type GatewayRedirectForm = {
  actionUrl: string;
  fields: Record<string, string>;
};

export type GatewayCheckoutParams = {
  amountPkr: number;
  txnRefNo: string;
  billReference: string;
  description: string;
  paymentId: string;
  customerEmail?: string;
  customerMobile?: string;
};
