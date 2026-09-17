import { connectDatabase, NotificationModel, UserModel } from "@zindagi/database";
import { AppError, NotificationChannels, Roles, emailLookupHash } from "@zindagi/shared";
import type { z } from "zod";
import type { adminSendNotificationSchema } from "@zindagi/validators";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { sendWhatsAppMessage } from "@/server/services/whatsapp.service";
import { sendExpoPushToUser } from "@/server/services/push.service";
import { sendEmail } from "@/server/services/email.service";
import { notificationEmail } from "@/server/lib/email-templates";

type SendInput = z.infer<typeof adminSendNotificationSchema>;

const CHANNEL_MAP = {
  in_app: NotificationChannels.IN_APP,
  sms: NotificationChannels.SMS,
  email: NotificationChannels.EMAIL,
} as const;

async function resolveRecipients(input: SendInput): Promise<string[]> {
  if (input.audience === "user") {
    if (input.userId) return [input.userId];
    if (input.userEmail) {
      const user = await UserModel.findOne({
        email: input.userEmail.toLowerCase(),
      }).lean();
      if (!user) throw new AppError("User not found", "NOT_FOUND", 404);
      return [user._id.toString()];
    }
    throw new AppError("userId or userEmail required", "VALIDATION_ERROR", 400);
  }

  const roleFilter =
    input.audience === "patients"
      ? Roles.PATIENT
      : input.audience === "doctors"
        ? Roles.DOCTOR
        : null;

  const filter: Record<string, unknown> = {
    isActive: { $ne: false },
    deletedAt: null,
  };
  if (roleFilter) filter.roles = roleFilter;

  const users = await UserModel.find(filter).select("_id email phone").lean();
  return users.map((u) => u._id.toString());
}

async function deliverExternal(
  channel: "sms" | "email",
  user: { email?: string | null; phone?: string | null },
  title: string,
  body: string,
) {
  const phone = safeDisplayText(user.phone);
  if (channel === "sms" && phone) {
    console.info(`[SMS stub] → ${phone}: ${title} — ${body}`);
    await sendWhatsAppMessage({ to: phone, title, body });
  }
  if (channel === "email" && user.email) {
    const { subject, html, text } = notificationEmail({ title, body });
    await sendEmail({ to: user.email, subject, html, text }).catch((err) => {
      console.error("[email] admin broadcast failed", err);
    });
  }
}

export async function adminSendNotification(input: SendInput) {
  await connectDatabase();

  const recipientIds = await resolveRecipients(input);
  const channel = CHANNEL_MAP[input.channel];
  const results = { sent: 0, failed: 0, recipientCount: recipientIds.length };

  // Each recipient's delivery is independent, so fan them out instead of awaiting
  // one at a time; bounded concurrency avoids hammering WhatsApp/Expo's rate limits.
  const outcomes = await mapWithConcurrency(recipientIds, 10, async (userId) => {
    try {
      if (input.channel === "in_app") {
        const user = await UserModel.findById(userId).select("phone").lean();
        await NotificationModel.create({
          userId,
          channel,
          title: input.title,
          body: input.body,
          payload: { source: "admin_broadcast" },
          sentAt: new Date(),
        });
        const phone = safeDisplayText(user?.phone);
        if (phone) {
          await sendWhatsAppMessage({
            to: phone,
            title: input.title,
            body: input.body,
          });
        }
        await sendExpoPushToUser(userId, {
          title: input.title,
          body: input.body,
          data: { type: "admin_broadcast" },
        }).catch(() => undefined);
      } else {
        const user = await UserModel.findById(userId).select("email phone").lean();
        if (user) {
          await deliverExternal(input.channel, user, input.title, input.body);
        }
        await NotificationModel.create({
          userId,
          channel,
          title: input.title,
          body: input.body,
          payload: { source: "admin_broadcast", delivered: input.channel },
          sentAt: new Date(),
        });
      }
      return true;
    } catch {
      return false;
    }
  });

  for (const ok of outcomes) {
    if (ok) results.sent += 1;
    else results.failed += 1;
  }

  return results;
}

export type UserNotificationDto = {
  id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export async function getNotificationSummary(userId: string) {
  await connectDatabase();
  const unreadCount = await NotificationModel.countDocuments({
    userId,
    channel: NotificationChannels.IN_APP,
    readAt: null,
  });
  return { unreadCount };
}

export async function listUserNotifications(
  userId: string,
  limit = 8,
): Promise<UserNotificationDto[]> {
  await connectDatabase();
  const docs = await NotificationModel.find({
    userId,
    channel: NotificationChannels.IN_APP,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    readAt: doc.readAt ? doc.readAt.toISOString() : undefined,
    createdAt: (doc.createdAt ?? doc.sentAt ?? new Date()).toISOString(),
    payload: (doc.payload as Record<string, unknown> | undefined) ?? {},
  }));
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await connectDatabase();
  const updated = await NotificationModel.findOneAndUpdate(
    mongoFilter({ _id: notificationId, userId }),
    { readAt: new Date() },
    { new: true },
  ).lean();

  if (!updated) {
    throw new AppError("Notification not found", "NOT_FOUND", 404);
  }

  return { id: updated._id.toString() };
}

export async function markAllNotificationsRead(userId: string) {
  await connectDatabase();
  await NotificationModel.updateMany(
    { userId, channel: NotificationChannels.IN_APP, readAt: null },
    { readAt: new Date() },
  );
  return { success: true };
}

export async function bootstrapAdminUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  await connectDatabase();
  const email = input.email.toLowerCase();

  let user = await UserModel.findOne({ emailLookup: emailLookupHash(email) }).select("+passwordHash");

  if (user) {
    if (!user.roles.includes(Roles.ADMIN)) {
      user.roles = [...new Set([...user.roles, Roles.ADMIN])];
      await user.save();
    }
    return {
      created: false,
      email,
      userId: user._id.toString(),
      message: "Existing user promoted to admin. Sign out and sign back in.",
    };
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(input.password, 12);

  user = await UserModel.create({
    name: input.name,
    email,
    passwordHash,
    roles: [Roles.ADMIN],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
  });

  return {
    created: true,
    email,
    userId: user._id.toString(),
    message: "Admin account created. Sign in with the credentials below.",
  };
}
