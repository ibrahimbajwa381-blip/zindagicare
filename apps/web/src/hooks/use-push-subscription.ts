"use client";

import { useCallback, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushSubscriptionState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
  error: string | null;
};

function getInitialPushState(): PushSubscriptionState {
  if (typeof window === "undefined") {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
      loading: false,
      error: null,
    };
  }

  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  return {
    supported,
    permission: supported ? Notification.permission : "unsupported",
    subscribed: false,
    loading: false,
    error: null,
  };
}

export function usePushSubscription() {
  const [state, setState] = useState<PushSubscriptionState>(getInitialPushState);

  const subscribe = useCallback(async () => {
    if (!state.supported) {
      return { ok: false as const, reason: "unsupported" as const };
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          loading: false,
          permission,
          subscribed: false,
        }));
        return { ok: false as const, reason: "denied" as const };
      }

      const keyRes = await fetch("/api/v1/push/vapid-key");
      const keyData = (await keyRes.json()) as {
        success?: boolean;
        data?: { configured?: boolean; publicKey?: string | null };
      };
      const publicKey = keyData.data?.publicKey;

      if (!keyData.data?.configured || !publicKey) {
        throw new Error("Push notifications are not configured on this server.");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription.");
      }

      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
          expirationTime: json.expirationTime ?? null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save push subscription.");
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        permission: "granted",
        subscribed: true,
        error: null,
      }));

      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Subscription failed";
      setState((prev) => ({
        ...prev,
        loading: false,
        subscribed: false,
        error: message,
      }));
      return { ok: false as const, reason: "error" as const, message };
    }
  }, [state.supported]);

  return { ...state, subscribe };
}
