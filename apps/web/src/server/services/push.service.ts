import webpush from "web-push";
import {
  connectDatabase,
  ExpoPushTokenModel,
  NotificationModel,
  PushSubscriptionModel,
} from "@zindagi/database";
import { NotificationChannels } from "@zindagi/shared";
import type { ExpoPushRegisterInput, PushSubscribeInput } from "@zindagi/validators";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:info.zindagicare@gmail.com";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function configureWebPush() {
  const config = getVapidConfig();
  if (!config) return false;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidConfig());
}

export async function upsertPushSubscription(
  userId: string,
  input: PushSubscribeInput,
  userAgent?: string | null,
) {
  await connectDatabase();

  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: input.endpoint },
    {
      userId,
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent: userAgent ?? undefined,
      lastUsedAt: new Date(),
      expiresAt: input.expirationTime ? new Date(input.expirationTime) : undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await connectDatabase();
  await PushSubscriptionModel.deleteOne({ userId, endpoint });
}

export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0 };
  }

  await connectDatabase();
  const subscriptions = await PushSubscriptionModel.find({ userId }).lean();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const pushBody = JSON.stringify(payload);

  // A user's subscriptions (one per device/browser) are delivered independently, so
  // fan them out instead of awaiting one at a time.
  const outcomes = await mapWithConcurrency(subscriptions, 10, async (sub) => {
    if (!sub.keys?.p256dh || !sub.keys?.auth) {
      return "failed" as const;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        pushBody,
      );
      await PushSubscriptionModel.updateOne(
        { _id: sub._id },
        { lastUsedAt: new Date() },
      );
      return "sent" as const;
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ _id: sub._id });
      }
      return "failed" as const;
    }
  });

  let sent = 0;
  let failed = 0;
  for (const outcome of outcomes) {
    if (outcome === "sent") sent += 1;
    else failed += 1;
  }

  if (sent > 0) {
    await NotificationModel.create({
      userId,
      channel: NotificationChannels.PUSH,
      title: payload.title,
      body: payload.body,
      payload: { url: payload.url, tag: payload.tag, delivered: true },
      sentAt: new Date(),
    }).catch(() => undefined);
  } else if (failed > 0 && subscriptions.length > 0) {
    await NotificationModel.create({
      userId,
      channel: NotificationChannels.PUSH,
      title: payload.title,
      body: payload.body,
      payload: { url: payload.url, tag: payload.tag, deliveryFailed: true },
      failedAt: new Date(),
      failureReason: "All push subscriptions failed",
    }).catch(() => undefined);
  }

  return { sent, failed };
}

export async function upsertExpoPushToken(userId: string, input: ExpoPushRegisterInput) {
  await connectDatabase();

  await ExpoPushTokenModel.findOneAndUpdate(
    { token: input.token },
    {
      userId,
      token: input.token,
      deviceId: input.deviceId ?? undefined,
      platform: input.platform ?? undefined,
      lastUsedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function removeExpoPushToken(userId: string, token: string) {
  await connectDatabase();
  await ExpoPushTokenModel.deleteOne({ userId, token });
}

export type ExpoPushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Sends a push notification to every registered mobile device for a user via Expo's push service. */
export async function sendExpoPushToUser(
  userId: string,
  payload: ExpoPushPayload,
): Promise<{ sent: number; failed: number }> {
  await connectDatabase();
  const tokens = await ExpoPushTokenModel.find({ userId }).lean();

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const batch of chunk(tokens, EXPO_PUSH_CHUNK_SIZE)) {
    const messages = batch.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default" as const,
    }));

    try {
      const res = await fetch(EXPO_PUSH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      const json = (await res.json()) as {
        data?: Array<{ status: "ok" | "error"; message?: string; details?: { error?: string } }>;
      };

      json.data?.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          sent += 1;
        } else {
          failed += 1;
          if (ticket.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(batch[i].token);
          }
        }
      });
    } catch (error) {
      failed += batch.length;
      console.error("[expo-push] send failed", error);
    }
  }

  if (invalidTokens.length > 0) {
    await ExpoPushTokenModel.deleteMany({ token: { $in: invalidTokens } }).catch(() => undefined);
  }

  if (sent > 0) {
    await ExpoPushTokenModel.updateMany(
      { userId, token: { $nin: invalidTokens } },
      { lastUsedAt: new Date() },
    ).catch(() => undefined);
  }

  return { sent, failed };
}
