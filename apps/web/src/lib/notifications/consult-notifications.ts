import { deliverUserNotification } from "@/lib/notifications/deliver-notification";
import { sendWebPushToUser } from "@/server/services/push.service";

export async function sendOnlineConsultConfirmation(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
  amount: number;
}) {
  const time = params.slotStart.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Online consult confirmed",
    body: `Your paid consult with Dr. ${params.doctorName} is booked for ${time}. Fee: Rs. ${params.amount.toLocaleString()}.`,
    payload: { type: "online_consult_confirmed" },
  });
}

export async function sendDoctorConsultBooked(params: {
  userId: string;
  phone?: string;
  patientName: string;
  slotStart: Date;
  appointmentId: string;
  type: "online" | "clinic" | "sunday_free" | "urgent_online";
  patientId?: string;
}) {
  const time = params.slotStart.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const label =
    params.type === "sunday_free"
      ? "Sunday Free Consult"
      : params.type === "clinic"
        ? "clinic appointment"
        : params.type === "urgent_online"
          ? "urgent care consult"
          : "online consult";

  const isUrgent = params.type === "urgent_online";
  const title = isUrgent ? "Urgent care patient waiting" : "New consult booked";
  const body = isUrgent
    ? `${params.patientName} needs an urgent video consult — join within 5–10 minutes (${time}).`
    : `${params.patientName} booked a ${label} for ${time}.`;

  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title,
    body,
    payload: isUrgent
      ? {
          type: "urgent_care_assigned",
          appointmentId: params.appointmentId,
          requestId: params.appointmentId,
        }
      : {
          type: "doctor_consult_booked",
          appointmentId: params.appointmentId,
          ...(params.patientId ? { patientId: params.patientId } : {}),
        },
  });

  if (isUrgent) {
    const pushUrl = `/doctor/urgent-calls?requestId=${encodeURIComponent(params.appointmentId)}`;
    await sendWebPushToUser(params.userId, {
      title,
      body,
      url: pushUrl,
      tag: `urgent-${params.appointmentId}`,
    }).catch((err) => {
      console.error("[urgent-care] doctor web push failed", err);
    });
  }
}

export async function sendPrescriptionIssued(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  prescriptionId: string;
  appointmentId: string;
}) {
  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "New prescription available",
    body: `Dr. ${params.doctorName} has issued a new prescription for you. Tap to view or download it.`,
    payload: {
      type: "prescription_issued",
      prescriptionId: params.prescriptionId,
      appointmentId: params.appointmentId,
    },
  });

  await sendWebPushToUser(params.userId, {
    title: "New prescription available",
    body: `Dr. ${params.doctorName} has issued a new prescription for you.`,
    url: "/prescriptions",
    tag: `prescription-${params.prescriptionId}`,
  }).catch((err) => {
    console.error("[prescription] patient web push failed", err);
  });
}

export async function sendUrgentConsultConfirmation(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
  amount: number;
  appointmentId?: string;
}) {
  await deliverUserNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Urgent care — doctor assigned",
    body: `Dr. ${params.doctorName} is ready for your urgent video consult. Join from your dashboard now. Fee: Rs. ${params.amount.toLocaleString()}.`,
    payload: {
      type: "urgent_consult_confirmed",
      ...(params.appointmentId ? { appointmentId: params.appointmentId } : {}),
    },
  });
}
