import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import MessagesScreen from "@app/messages/index";
import { listChatThreads } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/chat");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockList = listChatThreads as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const thread = {
  id: "thread-1",
  type: "consult",
  appointmentId: "appt-1",
  lastMessageAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  lastMessagePreview: "See you at the appointment",
  unreadCount: 2,
  isClosed: false,
  otherParticipant: { id: "doc-1", name: "Dr. Sara Ahmed", role: "doctor" as const },
};

describe("MessagesScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockList.mockResolvedValue([thread]);
  });

  it("redirects to login instead of rendering the thread list when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<MessagesScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<MessagesScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders a thread with name, preview, relative time, and unread badge", async () => {
    await render(<MessagesScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    expect(screen.getByText("See you at the appointment")).toBeTruthy();
    expect(screen.getByText("5m ago")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("shows a placeholder preview when there is no last message", async () => {
    mockList.mockResolvedValue([{ ...thread, lastMessagePreview: undefined, unreadCount: 0 }]);
    await render(<MessagesScreen />);
    await waitFor(() => expect(screen.getByText("No messages yet")).toBeTruthy());
    expect(screen.queryByText("2")).toBeNull();
  });

  it("shows the empty state when there are no conversations", async () => {
    mockList.mockResolvedValue([]);
    await render(<MessagesScreen />);
    expect(
      await screen.findByText("No conversations yet. A chat opens automatically once you have a confirmed consultation."),
    ).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Session expired", "AUTH", 401));
    await render(<MessagesScreen />);
    expect(await screen.findByText("Session expired")).toBeTruthy();
  });

  it("navigates to the thread when pressed", async () => {
    await render(<MessagesScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Sara Ahmed"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/messages/[threadId]",
      params: { threadId: "thread-1", name: "Dr. Sara Ahmed" },
    });
  });
});
