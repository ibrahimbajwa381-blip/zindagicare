import type { AppointmentStatus } from "@zindagi/shared";
import type { TestPaymentCheckout } from "@/lib/payments/dummy-payment";

export type OnlinePatientBookingDto = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus | string;
  consultationFee: number;
  doctor: {
    doctorId: string;
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
  canJoin: boolean;
  joinOpensAt: string;
  joinClosesAt: string;
};

export type CheckoutResult = {
  paymentId: string;
  appointmentId: string;
  amount: number;
  testMode?: boolean;
  testPayment?: TestPaymentCheckout;
  jazzcash?: {
    actionUrl: string;
    fields: Record<string, string>;
  };
};
