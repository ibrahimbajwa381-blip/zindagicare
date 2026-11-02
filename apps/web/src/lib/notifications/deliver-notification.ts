import { connectDatabase, NotificationModel, UserModel } from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";
import { sendWhatsAppMessage } from "@/server/services/whatsapp.service";
import { sendExpoPushToUser } from "@/server/services/push.service";
import { sendEmail } from "@/server/services/email.service";
import { notificationEmail } from "@/server/lib/email-templates";

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
  /** Skip email even when the account has one on file. Default false. */
  skipEmail?: boolean;
  /** Optional email button; both must be set. `ctaUrl` must be absolute. */
  ctaLabel?: string;
  ctaUrl?: string;
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

  const tasks: Promise<unknown>[] = [];

  if (!input.skipPush) {
    tasks.push(
      sendExpoPushToUser(input.userId, {
        title: input.title,
        body: input.body,
        data: input.payload,
      }).catch((err) => {
        console.error("[expo-push] deliver failed", err);
      }),
    );
  }

  if (!input.skipEmail) {
    tasks.push(
      UserModel.findById(input.userId)
        .select("email name")
        .lean()
        .then((user) => {
          if (!user?.email) return;
          const { subject, html, text } = notificationEmail({
            name: user.name,
            title: input.title,
            body: input.body,
            ctaLabel: input.ctaLabel,
            ctaUrl: input.ctaUrl,
          });
          return sendEmail({ to: user.email, subject, html, text });
        })
        .catch((err) => {
          console.error("[email] deliver failed", err);
        }),
    );
  }

  const phone = input.phone?.trim();
  if (phone) {
    if (process.env.SMS_API_KEY) {
      console.info("[SMS]", phone, input.body);
    }

    if (!input.skipWhatsApp) {
      tasks.push(
        sendWhatsAppMessage({
          to: phone,
          title: input.title,
          body: input.body,
        }).catch((err) => {
          console.error("[WhatsApp] deliver failed", err);
        }),
      );
    }
  }

  // Push/email/WhatsApp are independent side channels — fan them out
  // concurrently instead of paying their latency serially.
  await Promise.all(tasks);
}
