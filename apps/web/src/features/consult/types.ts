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
