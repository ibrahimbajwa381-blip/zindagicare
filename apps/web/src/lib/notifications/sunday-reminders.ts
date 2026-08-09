import { deliverUserNotification } from "@/lib/notifications/deliver-notification";

/**
 * Persists in-app notification + SMS stub / WhatsApp when providers are configured.
 */
export async function sendSundayReminder(input: {
  userId: string;
  title: string;
  body: string;
  phone?: string;
  payload: Record<string, unknown>;
}) {
  await deliverUserNotification(input);
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
