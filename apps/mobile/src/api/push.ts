import { apiFetch } from "./client";

export function registerExpoPushToken(input: { token: string; deviceId?: string; platform?: "ios" | "android" }) {
  return apiFetch<{ registered: boolean }>("/api/v1/push/expo/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function unregisterExpoPushToken(token: string) {
  return apiFetch<{ unregistered: boolean }>("/api/v1/push/expo/unregister", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
