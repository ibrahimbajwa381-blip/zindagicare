import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";
import { registerExpoPushToken, unregisterExpoPushToken } from "@/api/push";
import { getNotificationSummary } from "@/api/notifications";
import type { AuthUser } from "@/api/client";
import { API_URL } from "@/lib/config";

/**
 * expo-notifications' remote push functionality was removed from Expo Go in SDK 53 —
 * merely importing it there throws at module-eval time (top-level auto-registration
 * side effect). Guard the import itself, the same way auth-context.tsx guards
 * @react-native-google-signin/google-signin, so the rest of the app still works when
 * testing in plain Expo Go; push notifications are just unavailable there.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import("expo-notifications");
const Notifications: NotificationsModule | null = isExpoGo
  ? null
  : (require("expo-notifications") as NotificationsModule);

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Syncs the app icon badge to the server's unread in-app notification count. */
export async function syncBadgeCount() {
  if (!Notifications) return;
  try {
    const { unreadCount } = await getNotificationSummary();
    await Notifications.setBadgeCountAsync(unreadCount);
  } catch {
    // Not signed in, or offline — leave the badge as-is.
  }
}

async function configureAndroidChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0FA79B",
  });
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) return null;

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
    if (!Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      routeForNotificationData(data);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!Notifications || !user) return;
    const subscription = Notifications.addNotificationReceivedListener(() => {
      syncBadgeCount();
    });
    return () => subscription.remove();
  }, [user]);
}

/** Clears the locally registered push token from the backend, e.g. on sign-out. */
export async function unregisterCurrentPushToken() {
  if (!Notifications || !Device.isDevice) return;
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
    case "medical_question_answered": {
      // The Health Forum lives on the web app only; open the question page there.
      const questionId = typeof data?.questionId === "string" ? data.questionId : undefined;
      if (questionId && /^[a-f0-9]{24}$/i.test(questionId)) {
        void Linking.openURL(`${API_URL}/questions/${questionId}`).catch(() => router.push("/notifications"));
        return;
      }
      router.push("/notifications");
      return;
    }
    default:
      router.push("/notifications");
  }
}
