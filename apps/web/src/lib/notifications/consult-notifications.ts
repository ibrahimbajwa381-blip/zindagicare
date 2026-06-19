import { connectDatabase, NotificationModel } from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";

type ReminderPayload = {
  userId: string;
  title: string;
  body: string;
  phone?: string;
  payload: Record<string, unknown>;
};

async function sendConsultNotification(input: ReminderPayload) {
  await connectDatabase();

  await NotificationModel.create({
    userId: input.userId,
    channel: NotificationChannels.IN_APP,
    title: input.title,
    body: input.body,
    payload: input.payload,
    sentAt: new Date(),
  });

  if (input.phone && process.env.SMS_API_KEY) {
    console.info("[SMS]", input.phone, input.body);
  }
}

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

  await sendConsultNotification({
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

  await sendConsultNotification({
    userId: params.userId,
    phone: params.phone,
    title: params.type === "urgent_online" ? "Urgent care patient waiting" : "New consult booked",
    body:
      params.type === "urgent_online"
        ? `${params.patientName} needs an urgent video consult — join within 5–10 minutes (${time}).`
        : `${params.patientName} booked a ${label} for ${time}.`,
    payload: {
      type: "doctor_consult_booked",
      appointmentId: params.appointmentId,
    },
  });
}

export async function sendUrgentConsultConfirmation(params: {
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

  await sendConsultNotification({
    userId: params.userId,
    phone: params.phone,
    title: "Urgent care — doctor assigned",
    body: `Dr. ${params.doctorName} will call you by ${time}. Fee: Rs. ${params.amount.toLocaleString()}. Stay ready on your dashboard.`,
    payload: { type: "urgent_consult_confirmed" },
  });
}
