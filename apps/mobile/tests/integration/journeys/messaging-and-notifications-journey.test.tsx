// E2E journeys: Sections 11 and 12 — patient messaging and notifications.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import MessagesScreen from "@app/messages/index";
import MessagesThreadScreen from "@app/messages/[threadId]";
import NotificationsScreen from "@app/notifications/index";
import { router, useLocalSearchParams } from "expo-router";
import { listChatThreads, listChatMessages, sendChatMessage, markChatThreadRead } from "@/api/chat";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/api/notifications";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/chat");
jest.mock("@/api/notifications");
jest.mock("@/lib/push-notifications", () => ({ syncBadgeCount: jest.fn() }));
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockListChatThreads = listChatThreads as jest.Mock;
const mockListChatMessages = listChatMessages as jest.Mock;
const mockSendChatMessage = sendChatMessage as jest.Mock;
const mockMarkChatThreadRead = markChatThreadRead as jest.Mock;
const mockListNotifications = listNotifications as jest.Mock;
const mockMarkNotificationRead = markNotificationRead as jest.Mock;
const mockMarkAllNotificationsRead = markAllNotificationsRead as jest.Mock;

const threadWithDrAyesha = {
  id: "thread-1",
  otherParticipant: { id: "doc-a", name: "Dr. Ayesha Noor", avatarUrl: undefined },
  lastMessagePreview: "See you at 5pm",
  lastMessageAt: "2026-02-01T10:00:00.000Z",
  unreadCount: 2,
};

const threadWithDrBilal = {
  id: "thread-2",
  otherParticipant: { id: "doc-b", name: "Dr. Bilal Khan", avatarUrl: undefined },
  lastMessagePreview: "Your prescription is ready",
  lastMessageAt: "2026-02-02T10:00:00.000Z",
  unreadCount: 0,
};

describe("Section 11: patient messaging journey", () => {
  beforeEach(() => {
    mockMarkChatThreadRead.mockResolvedValue(undefined);
  });

  it("opens the correct conversation from the list, loads its history, sends a message, and it appears", async () => {
    mockListChatThreads.mockResolvedValue([threadWithDrAyesha, threadWithDrBilal]);
    await render(<MessagesScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ayesha Noor")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Ayesha Noor"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/messages/[threadId]",
      params: { threadId: "thread-1", name: "Dr. Ayesha Noor" },
    });

    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Dr. Ayesha Noor" });
    mockListChatMessages.mockResolvedValue({
      messages: [
        { id: "m1", body: "Hi doctor", createdAt: "2026-02-01T09:00:00.000Z", isMine: true },
        { id: "m2", body: "See you at 5pm", createdAt: "2026-02-01T10:00:00.000Z", isMine: false },
      ],
    });
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(mockMarkChatThreadRead).toHaveBeenCalledWith("thread-1"));
    expect(screen.getByText("Hi doctor")).toBeTruthy();
    expect(screen.getByText("See you at 5pm")).toBeTruthy();

    mockSendChatMessage.mockResolvedValue({ id: "m3", body: "Thanks!", createdAt: "2026-02-01T10:05:00.000Z", isMine: true });
    mockListChatMessages.mockResolvedValueOnce({
      messages: [
        { id: "m1", body: "Hi doctor", createdAt: "2026-02-01T09:00:00.000Z", isMine: true },
        { id: "m2", body: "See you at 5pm", createdAt: "2026-02-01T10:00:00.000Z", isMine: false },
        { id: "m3", body: "Thanks!", createdAt: "2026-02-01T10:05:00.000Z", isMine: true },
      ],
    });
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "Thanks!");
    await fireEvent.press(screen.getByTestId("chat-send-button"));

    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith("thread-1", "Thanks!"));
    expect(await screen.findByText("Thanks!")).toBeTruthy();
  });

  it("reopening a different conversation shows only that thread's messages, not the previous thread's", async () => {
    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Dr. Ayesha Noor" });
    mockListChatMessages.mockResolvedValue({ messages: [{ id: "m1", body: "Ayesha's message", createdAt: "2026-02-01T09:00:00.000Z", isMine: false }] });
    await render(<MessagesThreadScreen />);
    expect(await screen.findByText("Ayesha's message")).toBeTruthy();

    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-2", name: "Dr. Bilal Khan" });
    mockListChatMessages.mockResolvedValue({ messages: [{ id: "m2", body: "Bilal's message", createdAt: "2026-02-02T09:00:00.000Z", isMine: false }] });
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(mockListChatMessages).toHaveBeenLastCalledWith("thread-2"));
    expect(screen.getByText("Bilal's message")).toBeTruthy();
    expect(screen.queryByText("Ayesha's message")).toBeNull();
  });

  it("shows the empty-conversation hint, then the sent message once one is sent", async () => {
    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Dr. Ayesha Noor" });
    mockListChatMessages.mockResolvedValueOnce({ messages: [] });
    await render(<MessagesThreadScreen />);
    expect(await screen.findByText("No messages yet. Say hello.")).toBeTruthy();

    mockSendChatMessage.mockResolvedValue({ id: "m1", body: "Hello!", createdAt: "2026-02-01T09:00:00.000Z", isMine: true });
    mockListChatMessages.mockResolvedValueOnce({ messages: [{ id: "m1", body: "Hello!", createdAt: "2026-02-01T09:00:00.000Z", isMine: true }] });
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "Hello!");
    await fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(await screen.findByText("Hello!")).toBeTruthy();
  });

  it("recovers the typed draft after a send failure, and a retry succeeds", async () => {
    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Dr. Ayesha Noor" });
    mockListChatMessages.mockResolvedValue({ messages: [] });
    mockSendChatMessage
      .mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0))
      .mockResolvedValueOnce({ id: "m1", body: "Are you available?", createdAt: "2026-02-01T09:00:00.000Z", isMine: true });
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());

    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "Are you available?");
    await fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(await screen.findByText("Network error")).toBeTruthy();
    // The draft is restored so the user does not have to retype it.
    expect(screen.getByDisplayValue("Are you available?")).toBeTruthy();

    mockListChatMessages.mockResolvedValueOnce({ messages: [{ id: "m1", body: "Are you available?", createdAt: "2026-02-01T09:00:00.000Z", isMine: true }] });
    await fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(await screen.findByText("Are you available?")).toBeTruthy();
    expect(screen.queryByText("Network error")).toBeNull();
  });
});

describe("Section 12: notifications journey", () => {
  it("opens an unread notification and marks only that one read, leaving the other notification's unread state untouched", async () => {
    // Note: "Mark all read" is exposed via `Stack.Screen`'s `headerRight` navigation option,
    // which this project's expo-router test mock (like its `Stack`/`Stack.Screen` stubs) does
    // not render into the screen's own tree — the same limitation the app's existing unit
    // test suite has, which imports/mocks `markAllNotificationsRead` but never exercises it
    // through the UI either. That control is exercised at the unit level only; see the report.
    mockListNotifications.mockResolvedValueOnce([
      { id: "n1", title: "Prescription issued", body: "Dr. Ayesha issued a new prescription.", createdAt: "2026-02-01T09:00:00.000Z", readAt: null, type: "prescription" },
      { id: "n2", title: "Appointment reminder", body: "Your consult starts in 1 hour.", createdAt: "2026-02-01T08:00:00.000Z", readAt: null, type: "appointment" },
    ]);
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Prescription issued")).toBeTruthy());

    mockMarkNotificationRead.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByText("Prescription issued"));
    await waitFor(() => expect(mockMarkNotificationRead).toHaveBeenCalledWith("n1"));
    expect(mockMarkNotificationRead).not.toHaveBeenCalledWith("n2");

    // Re-opening the already-read notification must not fire a second mark-read call.
    await fireEvent.press(screen.getByText("Prescription issued"));
    expect(mockMarkNotificationRead).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when there are no notifications", async () => {
    mockListNotifications.mockResolvedValue([]);
    await render(<NotificationsScreen />);
    expect(await screen.findByText("No notifications yet.")).toBeTruthy();
  });
});
