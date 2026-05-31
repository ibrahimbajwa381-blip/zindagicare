import { connectDatabase, NotificationModel, UserModel } from "@zindagi/database";
import { AppError, NotificationChannels, Roles } from "@zindagi/shared";
import type { z } from "zod";
import type { adminSendNotificationSchema } from "@zindagi/validators";

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
  if (channel === "sms" && user.phone) {
    console.info(`[SMS stub] → ${user.phone}: ${title} — ${body}`);
  }
  if (channel === "email" && user.email) {
    console.info(`[Email stub] → ${user.email}: ${title} — ${body}`);
  }
}

export async function adminSendNotification(input: SendInput) {
  await connectDatabase();

  const recipientIds = await resolveRecipients(input);
  const channel = CHANNEL_MAP[input.channel];
  const results = { sent: 0, failed: 0, recipientCount: recipientIds.length };

  for (const userId of recipientIds) {
    try {
      if (input.channel === "in_app") {
        await NotificationModel.create({
          userId,
          channel,
          title: input.title,
          body: input.body,
          payload: { source: "admin_broadcast" },
        });
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
        });
      }
      results.sent += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
}

export async function bootstrapAdminUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  await connectDatabase();
  const email = input.email.toLowerCase();

  let user = await UserModel.findOne({ email }).select("+passwordHash");

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
    roles: [Roles.ADMIN, Roles.PATIENT],
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
