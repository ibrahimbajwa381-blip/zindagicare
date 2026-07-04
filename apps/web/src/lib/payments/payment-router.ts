import { connectDatabase, PaymentModel, AppointmentModel } from "@zindagi/database";
import { AppointmentTypes, PaymentProviders } from "@zindagi/shared";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { mongoFilter } from "@/lib/mongo/query";

const URGENT_PAYMENT_KIND = "urgent_care";

type PaymentKind = "urgent_care" | "online" | null;

async function resolvePaymentKind(paymentId: string): Promise<PaymentKind> {
  await connectDatabase();
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment) return null;

  const metadata = payment.metadata as { kind?: string } | undefined;
  if (metadata?.kind === URGENT_PAYMENT_KIND) return "urgent_care";
  if (payment.appointmentId) return "online";
  return null;
}

async function resolveAppointmentType(paymentId: string) {
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment?.appointmentId) return null;

  const appointment = await AppointmentModel.findById(payment.appointmentId).lean();
  return appointment?.type ?? null;
}

export async function resolvePaymentIdFromGatewayCallback(params: {
  paymentId?: string;
  orderRef?: string;
  provider?: string;
}): Promise<string | null> {
  if (params.paymentId) return params.paymentId;
  if (!params.orderRef) return null;

  await connectDatabase();
  const payment = await PaymentModel.findOne(
    mongoFilter({
      externalTransactionId: params.orderRef,
      ...(params.provider ? { provider: params.provider } : {}),
    }),
  ).lean();

  return payment?._id.toString() ?? null;
}

export async function completePaymentAfterGateway(
  paymentId: string,
  externalTransactionId?: string,
) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.confirmAfterPayment(paymentId, externalTransactionId);
  }
  return OnlineConsultService.confirmAfterPayment(paymentId, externalTransactionId);
}

export async function completeTestPayment(paymentId: string, userId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.completeTestPayment(paymentId, userId);
  }
  return OnlineConsultService.completeTestPayment(paymentId, userId);
}

export async function failPayment(paymentId: string, reason?: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.failPayment(paymentId, reason);
  }
  return OnlineConsultService.failPayment(paymentId, reason);
}

export async function paymentSuccessPath(paymentId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return `/urgent-care/success?paymentId=${paymentId}`;
  }

  const appointmentType = await resolveAppointmentType(paymentId);
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    return `/urgent-care/success?paymentId=${paymentId}`;
  }
  return `/doctors/booking/success?paymentId=${paymentId}`;
}

export async function paymentFailedPath(paymentId: string, reason?: string) {
  const kind = await resolvePaymentKind(paymentId);
  const q = reason ? `&reason=${encodeURIComponent(reason)}` : "";

  if (kind === "urgent_care") {
    return `/urgent-care/failed?paymentId=${paymentId}${q}`;
  }

  const appointmentType = await resolveAppointmentType(paymentId);
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    return `/urgent-care/failed?paymentId=${paymentId}${q}`;
  }
  return `/doctors/booking/failed?paymentId=${paymentId}${q}`;
}

export async function paymentPayPath(paymentId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return `/urgent-care/pay?paymentId=${paymentId}`;
  }

  const appointmentType = await resolveAppointmentType(paymentId);
  if (appointmentType === AppointmentTypes.URGENT_ONLINE) {
    return `/urgent-care/pay?paymentId=${paymentId}`;
  }
  return `/doctors/booking/pay?paymentId=${paymentId}`;
}

export async function getPaymentStatus(paymentId: string, userId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.getPaymentStatus(paymentId, userId);
  }
  return OnlineConsultService.getPaymentStatus(paymentId, userId);
}
