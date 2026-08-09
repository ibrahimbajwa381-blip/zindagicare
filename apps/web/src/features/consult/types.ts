import type { AppointmentStatus } from "@zindagi/shared";
import type { TestPaymentCheckout } from "@/lib/payments/dummy-payment";
import type { ManualTransferCheckout } from "@/lib/payments/manual-payment";
import type { GatewayRedirectForm } from "@/lib/payments/types";
import type { PaymentProviderInput } from "@zindagi/validators";

export type OnlinePatientBookingDto = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus | string;
  consultationFee: number;
  doctor: {
    doctorId: string;
    /** User account id — required for `/messages?doctor=` deep links. */
    userId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
    pmdcVerified: boolean;
    ratingAvg: number;
    ratingCount: number;
  };
};

export type VideoJoinPayload = {
  appointmentId: string;
  sessionId: string;
  role: "patient" | "doctor";
  userName: string;
  meetingNumber: string;
  passcode: string;
  signature: string;
  sdkKey: string;
  joinUrl: string;
  startUrl?: string;
  scheduledStart: string;
  scheduledEnd: string;
  counterpartName: string;
  meetingTitle: string;
  canJoin: boolean;
  joinOpensAt: string;
  joinClosesAt: string;
  appointmentType?: string;
};

export type CheckoutResult = {
  paymentId: string;
  appointmentId: string;
  amount: number;
  manualTransfer?: ManualTransferCheckout;
  /** @deprecated use manualTransfer */
  testMode?: boolean;
  /** @deprecated use manualTransfer */
  testPayment?: TestPaymentCheckout;
  gatewayRedirect?: GatewayRedirectForm;
  /** @deprecated use gatewayRedirect */
  jazzcash?: GatewayRedirectForm;
};

export type { PaymentProviderInput };
