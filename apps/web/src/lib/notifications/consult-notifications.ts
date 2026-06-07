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
