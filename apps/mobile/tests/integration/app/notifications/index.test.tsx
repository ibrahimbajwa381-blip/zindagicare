import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import NotificationsScreen from "@app/notifications/index";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/api/notifications";
import { ApiRequestError } from "@/api/client";
import { syncBadgeCount } from "@/lib/push-notifications";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/notifications");
jest.mock("@/lib/push-notifications", () => ({ syncBadgeCount: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockList = listNotifications as jest.Mock;
const mockMarkRead = markNotificationRead as jest.Mock;
const mockMarkAllRead = markAllNotificationsRead as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const notification = {
  id: "notif-1",
  title: "Appointment confirmed",
  body: "Your consult with Dr. Sara Ahmed is confirmed.",
  createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  payload: {},
};

describe("NotificationsScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockList.mockResolvedValue([notification]);
  });

  it("redirects to login instead of rendering notifications when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<NotificationsScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<NotificationsScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders a notification with title, body, and relative time", async () => {
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Appointment confirmed")).toBeTruthy());
    expect(screen.getByText("Your consult with Dr. Sara Ahmed is confirmed.")).toBeTruthy();
    expect(screen.getByText("10m ago")).toBeTruthy();
  });

  it("syncs the badge count after loading", async () => {
    await render(<NotificationsScreen />);
    await waitFor(() => expect(syncBadgeCount).toHaveBeenCalled());
  });

  it("shows the empty state when there are no notifications", async () => {
    mockList.mockResolvedValue([]);
    await render(<NotificationsScreen />);
    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<NotificationsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("marks a notification read (optimistically) when opened", async () => {
    mockMarkRead.mockResolvedValue({ id: "notif-1" });
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Appointment confirmed")).toBeTruthy());

    await fireEvent.press(screen.getByText("Appointment confirmed"));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith("notif-1"));
  });

  it("does not re-mark an already-read notification", async () => {
    mockList.mockResolvedValue([{ ...notification, readAt: new Date().toISOString() }]);
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Appointment confirmed")).toBeTruthy());

    await fireEvent.press(screen.getByText("Appointment confirmed"));
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it("renders a large (150-row) notification list through the real component tree without crashing", async () => {
    const largeList = Array.from({ length: 150 }, (_, i) => ({
      id: `notif-${i}`,
      title: i === 75 ? "" : `Notification ${i}`, // edge case: empty title mid-list
      body: `Body text for notification ${i}`,
      createdAt: new Date(Date.now() - i * 90 * 60_000).toISOString(), // spans minutes to days old
      payload: {},
      readAt: i % 3 === 0 ? new Date().toISOString() : undefined,
    }));
    mockList.mockResolvedValue(largeList);

    await render(<NotificationsScreen />);

    // The real renderItem (unread dot, relative time formatting across minute/hour/day
    // ranges) must run against the full 150-row dataset without crashing or hanging.
    expect(await screen.findByText("Notification 0")).toBeTruthy();
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByTestId("notifications-list")).toBeTruthy());

    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("notifications-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B (rapid second pull), pending

    await act(async () => {
      resolveB!([{ ...notification, id: "notif-new", title: "New Notification" }]); // B (newer) resolves first
    });
    expect(await screen.findByText("New Notification")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...notification, id: "notif-old", title: "Old Notification" }]); // A (older) resolves late
    });

    expect(await screen.findByText("New Notification")).toBeTruthy();
    expect(screen.queryByText("Old Notification")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Appointment confirmed")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("notifications-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Appointment confirmed")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<NotificationsScreen />);
    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
  });
});
