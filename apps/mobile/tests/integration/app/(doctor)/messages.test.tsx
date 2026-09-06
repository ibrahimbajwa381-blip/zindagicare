import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import DoctorMessagesScreen from "@app/(doctor)/messages";
import { listChatThreads } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";

jest.mock("@/api/chat");

const mockList = listChatThreads as jest.Mock;

const thread = {
  id: "thread-1",
  type: "consult",
  lastMessageAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  lastMessagePreview: "Thanks doctor",
  unreadCount: 1,
  isClosed: false,
  otherParticipant: { id: "p-1", name: "Ayesha Khan", role: "patient" as const },
};

describe("DoctorMessagesScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([thread]);
  });

  it("renders a thread with name, preview, time, and unread badge", async () => {
    await render(<DoctorMessagesScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("Thanks doctor")).toBeTruthy();
    expect(screen.getByText("5m ago")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("shows the empty state", async () => {
    mockList.mockResolvedValue([]);
    await render(<DoctorMessagesScreen />);
    expect(await screen.findByText("No conversations yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorMessagesScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("navigates to the doctor thread screen", async () => {
    await render(<DoctorMessagesScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    await fireEvent.press(screen.getByText("Ayesha Khan"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(doctor)/messages-thread",
      params: { threadId: "thread-1", name: "Ayesha Khan" },
    });
  });

  it("does not let a slow initial-focus response overwrite a faster, later poll response", async () => {
    jest.useFakeTimers();
    try {
      let resolveA: (v: unknown) => void;
      let resolveB: (v: unknown) => void;
      const requestA = new Promise((resolve) => {
        resolveA = resolve;
      });
      const requestB = new Promise((resolve) => {
        resolveB = resolve;
      });
      mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

      await render(<DoctorMessagesScreen />); // fires the initial focus load (call A), pending

      await act(async () => {
        jest.advanceTimersByTime(15000); // POLL_MS — fires the poll tick (call B), pending
      });

      await act(async () => {
        resolveB!([{ ...thread, id: "thread-new", otherParticipant: { ...thread.otherParticipant, name: "New Patient" } }]); // B (newer) resolves first
      });
      expect(await screen.findByText("New Patient")).toBeTruthy();

      await act(async () => {
        resolveA!([{ ...thread, id: "thread-old", otherParticipant: { ...thread.otherParticipant, name: "Old Patient" } }]); // A (older) resolves late
      });

      expect(await screen.findByText("New Patient")).toBeTruthy();
      expect(screen.queryByText("Old Patient")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
