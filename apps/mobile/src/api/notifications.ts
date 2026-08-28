import { apiFetch } from "./client";

export type NotificationDto = {
  id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

/** The route ignores query params and always returns the 8 most recent (see notification.service.ts). */
export function listNotifications() {
  return apiFetch<NotificationDto[]>("/api/v1/notifications");
}

export function markNotificationRead(id: string) {
  return apiFetch<{ id: string }>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiFetch<{ success: boolean }>("/api/v1/notifications/read-all", { method: "PATCH" });
}
