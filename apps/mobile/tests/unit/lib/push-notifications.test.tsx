import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { syncBadgeCount, usePushNotifications, unregisterCurrentPushToken } from "@/lib/push-notifications";
import { getNotificationSummary } from "@/api/notifications";
import { registerExpoPushToken, unregisterExpoPushToken } from "@/api/push";
import { router } from "expo-router";
import { makeAuthUser } from "@/test-utils/mock-auth";

jest.mock("@/api/notifications");
jest.mock("@/api/push");
jest.mock("expo-notifications");
jest.mock("expo-device", () => ({ isDevice: true }));
// The project-wide __mocks__/expo-constants.ts simulates Expo Go (StoreClient), under which
// push-notifications.ts treats the whole expo-notifications module as unavailable. Override it
// here so this file exercises the real (non-Expo-Go) push registration path it's testing.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "standalone",
    expoConfig: { extra: { eas: { projectId: "test-project-id" } } },
    easConfig: { projectId: "test-project-id" },
  },
  ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
}));

const mockGetSummary = getNotificationSummary as jest.Mock;
const mockRegisterToken = registerExpoPushToken as jest.Mock;
const mockUnregisterToken = unregisterExpoPushToken as jest.Mock;
const mockSetBadgeCountAsync = Notifications.setBadgeCountAsync as jest.Mock;
const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushTokenAsync = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockAddNotificationResponseReceivedListener =
  Notifications.addNotificationResponseReceivedListener as jest.Mock;
const mockAddNotificationReceivedListener = Notifications.addNotificationReceivedListener as jest.Mock;

describe("syncBadgeCount", () => {
  it("sets the badge count from the server summary", async () => {
    mockGetSummary.mockResolvedValue({ unreadCount: 4, chatUnreadCount: 1 });
    await syncBadgeCount();
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(4);
  });

  it("silently does nothing when the summary request fails", async () => {
    mockGetSummary.mockRejectedValue(new Error("network error"));
    await expect(syncBadgeCount()).resolves.toBeUndefined();
    expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
  });
});

describe("usePushNotifications", () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "expo-push-token" });
    mockGetSummary.mockResolvedValue({ unreadCount: 0, chatUnreadCount: 0 });
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
    mockAddNotificationReceivedListener.mockReturnValue({ remove: jest.fn() });
  });

  it("does not register a push token when there is no user", async () => {
    await renderHook(() => usePushNotifications(null));
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it("registers the push token when a user is present", async () => {
    await renderHook(() => usePushNotifications(makeAuthUser()));
    await waitFor(() => {
      expect(mockRegisterToken).toHaveBeenCalledWith({ token: "expo-push-token", platform: expect.any(String) });
    });
  });

  it("requests permission when not already granted", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    await renderHook(() => usePushNotifications(makeAuthUser()));
    await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalled());
  });

  it("does not register a token when permission is denied", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "denied" });
    mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });
    await renderHook(() => usePushNotifications(makeAuthUser()));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it("routes to urgent-calls for an urgent_care_assigned notification tap", async () => {
    await renderHook(() => usePushNotifications(null));
    const callback = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    callback({ notification: { request: { content: { data: { type: "urgent_care_assigned", requestId: "req-1" } } } } });
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(doctor)/urgent-calls",
      params: { requestId: "req-1" },
    });
  });

  it("routes to appointments for a prescription_issued notification tap", async () => {
    await renderHook(() => usePushNotifications(null));
    const callback = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    callback({ notification: { request: { content: { data: { type: "prescription_issued" } } } } });
    expect(router.push).toHaveBeenCalledWith("/(tabs)/appointments");
  });

  it("routes to the notifications list for unknown or missing types", async () => {
    await renderHook(() => usePushNotifications(null));
    const callback = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    callback({ notification: { request: { content: { data: undefined } } } });
    expect(router.push).toHaveBeenCalledWith("/notifications");
  });
});

describe("unregisterCurrentPushToken", () => {
  it("unregisters the token and clears the badge", async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "expo-push-token" });
    await unregisterCurrentPushToken();
    expect(mockUnregisterToken).toHaveBeenCalledWith("expo-push-token");
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  it("does nothing on a non-physical device", async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    await unregisterCurrentPushToken();
    expect(mockUnregisterToken).not.toHaveBeenCalled();
    (Device as { isDevice: boolean }).isDevice = true;
  });
});
