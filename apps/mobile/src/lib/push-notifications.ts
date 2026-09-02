import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerExpoPushToken, unregisterExpoPushToken } from "@/api/push";
import { getNotificationSummary } from "@/api/notifications";
import type { AuthUser } from "@/api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Syncs the app icon badge to the server's unread in-app notification count. */
export async function syncBadgeCount() {
  try {
    const { unreadCount } = await getNotificationSummary();
    await Notifications.setBadgeCountAsync(unreadCount);
  } catch {
    // Not signed in, or offline — leave the badge as-is.
  }
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0FA79B",
  });
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Requests permission, registers the device's Expo push token with the backend, and routes on notification taps. */
export function usePushNotifications(user: AuthUser | null) {
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    configureAndroidChannel();
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getExpoPushToken();
        if (!token || cancelled) return;
        await registerExpoPushToken({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
        registeredTokenRef.current = token;
      } catch (err) {
        console.error("[push] registration failed", err);
      } finally {
        if (!cancelled) syncBadgeCount();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      routeForNotificationData(data);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user) return;
    const subscription = Notifications.addNotificationReceivedListener(() => {
      syncBadgeCount();
    });
    return () => subscription.remove();
  }, [user]);
}

/** Clears the locally registered push token from the backend, e.g. on sign-out. */
export async function unregisterCurrentPushToken() {
  if (!Device.isDevice) return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    await unregisterExpoPushToken(data);
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // No token was ever registered on this device, or already signed out — fine.
  }
}

function routeForNotificationData(data: Record<string, unknown> | undefined) {
  const type = typeof data?.type === "string" ? data.type : undefined;

  switch (type) {
    case "urgent_care_assigned": {
      const requestId = typeof data?.requestId === "string" ? data.requestId : undefined;
      router.push(
        requestId
          ? { pathname: "/(doctor)/urgent-calls", params: { requestId } }
          : "/(doctor)/urgent-calls",
      );
      return;
    }
    case "doctor_consult_booked":
      router.push("/(doctor)/requests");
      return;
    case "online_consult_confirmed":
    case "urgent_consult_confirmed":
    case "prescription_issued":
      router.push("/(tabs)/appointments");
      return;
    default:
      router.push("/notifications");
  }
}
