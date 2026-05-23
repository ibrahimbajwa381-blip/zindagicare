import { connectDatabase, NotificationModel } from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";

type ReminderPayload = {
  userId: string;
  title: string;
  body: string;
  phone?: string;
  payload: Record<string, unknown>;
};

/**
 * Persists in-app notification + logs SMS/WhatsApp (wire providers in production).
 */
export async function sendSundayReminder(input: ReminderPayload) {
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
    // TODO: Jazz/SMS gateway adapter
    console.info("[SMS]", input.phone, input.body);
  }

  if (input.phone && process.env.WHATSAPP_API_KEY) {
    console.info("[WhatsApp]", input.phone, input.body);
  }
}

export async function sendBookingConfirmation(params: {
  userId: string;
  phone?: string;
  doctorName: string;
  slotStart: Date;
}) {
  const time = params.slotStart.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  await sendSundayReminder({
    userId: params.userId,
    phone: params.phone,
    title: "Sunday Free Consult confirmed",
    body: `Your free consult with Dr. ${params.doctorName} is booked for ${time}.`,
    payload: { type: "sunday_booking_confirmed" },
  });
}
