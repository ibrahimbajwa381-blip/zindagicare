import { connectDatabase, NotificationModel } from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";
import { sendWhatsAppMessage } from "@/server/services/whatsapp.service";
import { sendExpoPushToUser } from "@/server/services/push.service";

export type DeliverNotificationInput = {
  userId: string;
  title: string;
  body: string;
  phone?: string | null;
  payload: Record<string, unknown>;
  /** Skip WhatsApp even when phone + provider are available. Default false. */
  skipWhatsApp?: boolean;
  /** Skip the mobile push notification. Default false. */
  skipPush?: boolean;
};

/**
 * Persist an in-app notification and fan out to mobile push, SMS (stub), and
 * WhatsApp when configured.
 */
export async function deliverUserNotification(
  input: DeliverNotificationInput,
): Promise<void> {
  await connectDatabase();

  await NotificationModel.create({
    userId: input.userId,
    channel: NotificationChannels.IN_APP,
    title: input.title,
    body: input.body,
    payload: input.payload,
    sentAt: new Date(),
  });

  if (!input.skipPush) {
    await sendExpoPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      data: input.payload,
    }).catch((err) => {
      console.error("[expo-push] deliver failed", err);
    });
  }

  const phone = input.phone?.trim();
  if (!phone) return;

  if (process.env.SMS_API_KEY) {
    console.info("[SMS]", phone, input.body);
  }

  if (!input.skipWhatsApp) {
    await sendWhatsAppMessage({
      to: phone,
      title: input.title,
      body: input.body,
    }).catch((err) => {
      console.error("[WhatsApp] deliver failed", err);
    });
  }
}
