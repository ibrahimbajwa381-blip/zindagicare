import { connectDatabase, PaymentModel, AppointmentModel } from "@zindagi/database";
import { AppointmentTypes } from "@zindagi/shared";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { mongoFilter } from "@/lib/mongo/query";

const URGENT_PAYMENT_KIND = "urgent_care";
const SUNDAY_PAYMENT_KIND = "sunday_consult";

type PaymentKind = "urgent_care" | "sunday_consult" | "online" | null;

async function resolvePaymentKind(paymentId: string): Promise<PaymentKind> {
  await connectDatabase();
  const payment = await PaymentModel.findById(paymentId).lean();
  if (!payment) return null;

  const metadata = payment.metadata as { kind?: string } | undefined;
  if (metadata?.kind === URGENT_PAYMENT_KIND) return "urgent_care";
  if (metadata?.kind === SUNDAY_PAYMENT_KIND) return "sunday_consult";
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
  if (kind === "sunday_consult") {
    return SundayConsultService.confirmAfterPayment(paymentId, externalTransactionId);
  }
  return OnlineConsultService.confirmAfterPayment(paymentId, externalTransactionId);
}

export async function completeTestPayment(paymentId: string, userId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.completeTestPayment(paymentId, userId);
  }
  if (kind === "sunday_consult") {
    return SundayConsultService.completeTestPayment(paymentId, userId);
  }
  return OnlineConsultService.completeTestPayment(paymentId, userId);
}

export async function submitManualPaymentReceipt(
  paymentId: string,
  userId: string,
  receipt: {
    storageKey: string;
    url: string;
    originalName: string;
    mimeType: string;
    transactionId?: string;
  },
) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.submitManualReceipt(paymentId, userId, receipt);
  }
  if (kind === "sunday_consult") {
    return SundayConsultService.submitManualReceipt(paymentId, userId, receipt);
  }
  return OnlineConsultService.submitManualReceipt(paymentId, userId, receipt);
}

export async function failPayment(paymentId: string, reason?: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return UrgentConsultService.failPayment(paymentId, reason);
  }
  if (kind === "sunday_consult") {
    return SundayConsultService.failPayment(paymentId, reason);
  }
  return OnlineConsultService.failPayment(paymentId, reason);
}

export async function paymentSuccessPath(paymentId: string) {
  const kind = await resolvePaymentKind(paymentId);
  if (kind === "urgent_care") {
    return `/urgent-care/success?paymentId=${paymentId}`;
  }
  if (kind === "sunday_consult") {
    return `/sunday-consult?paid=1`;
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
  if (kind === "sunday_consult") {
    return `/sunday-consult/pay?paymentId=${paymentId}${q}`;
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
  if (kind === "sunday_consult") {
    return `/sunday-consult/pay?paymentId=${paymentId}`;
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
  if (kind === "sunday_consult") {
    return SundayConsultService.getPaymentStatus(paymentId, userId);
  }
  return OnlineConsultService.getPaymentStatus(paymentId, userId);
}
