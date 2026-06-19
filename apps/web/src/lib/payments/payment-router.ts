import { PaymentModel, AppointmentModel } from "@zindagi/database";
import { AppointmentTypes } from "@zindagi/shared";
import { OnlineConsultService } from "@/server/services/online-consult.service";

async function resolveAppointmentType(paymentId: string) {
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment?.appointmentId) return null;

  const appointment = await AppointmentModel.findById(payment.appointmentId).lean();
  return appointment?.type ?? null;
}

export async function completePaymentAfterGateway(
  paymentId: string,
  externalTransactionId?: string,
) {
  return OnlineConsultService.confirmAfterPayment(paymentId, externalTransactionId);
}

export async function completeTestPayment(paymentId: string, userId: string) {
  return OnlineConsultService.completeTestPayment(paymentId, userId);
}

export async function failPayment(paymentId: string, reason?: string) {
  return OnlineConsultService.failPayment(paymentId, reason);
}

export function paymentSuccessPath(paymentId: string, appointmentType: string | null) {
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    return `/urgent-care/success?paymentId=${paymentId}`;
  }
  return `/doctors/booking/success?paymentId=${paymentId}`;
}

export function paymentFailedPath(paymentId: string, appointmentType: string | null, reason?: string) {
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    const q = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    return `/urgent-care/failed?paymentId=${paymentId}${q}`;
  }
  const q = reason ? `&reason=${encodeURIComponent(reason)}` : "";
  return `/doctors/booking/failed?paymentId=${paymentId}${q}`;
}

export function paymentPayPath(paymentId: string, appointmentType: string | null) {
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    return `/urgent-care/pay?paymentId=${paymentId}`;
  }
  return `/doctors/booking/pay?paymentId=${paymentId}`;
}

export async function getPaymentStatus(paymentId: string, userId: string) {
  return OnlineConsultService.getPaymentStatus(paymentId, userId);
}
