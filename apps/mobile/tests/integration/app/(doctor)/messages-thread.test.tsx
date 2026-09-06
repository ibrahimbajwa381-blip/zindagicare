import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import DoctorMessagesThreadScreen from "@app/(doctor)/messages-thread";
import { listChatMessages, markChatThreadRead, sendChatMessage } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams } from "expo-router";

jest.mock("@/api/chat");
jest.mock("@/components/chat/file-attachment-button", () => {
  const { Text } = require("react-native");
  return { FileAttachmentButton: () => <Text>FileAttachmentButtonStub</Text> };
});
jest.mock("@/components/chat/voice-recorder-button", () => {
  const { Text } = require("react-native");
  return { VoiceRecorderButton: () => <Text>VoiceRecorderButtonStub</Text> };
});

const mockListMessages = listChatMessages as jest.Mock;
const mockMarkRead = markChatThreadRead as jest.Mock;
const mockSend = sendChatMessage as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

const message = {
  id: "m1",
  threadId: "thread-1",
  body: "How are you feeling today?",
  createdAt: "2026-01-01T05:00:00.000Z",
  isMine: true,
  readBy: [],
};

describe("DoctorMessagesThreadScreen", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Ayesha Khan" });
    mockListMessages.mockResolvedValue({ messages: [message], hasMore: false });
    mockMarkRead.mockResolvedValue({ ok: true });
  });

  it("loads and renders messages, marking the thread read", async () => {
    await render(<DoctorMessagesThreadScreen />);
    await waitFor(() => expect(screen.getByText("How are you feeling today?")).toBeTruthy());
    expect(mockMarkRead).toHaveBeenCalledWith("thread-1");
  });

  it("shows the empty state", async () => {
    mockListMessages.mockResolvedValue({ messages: [], hasMore: false });
    await render(<DoctorMessagesThreadScreen />);
    expect(await screen.findByText("No messages yet. Say hello.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockListMessages.mockRejectedValue(new ApiRequestError("Thread not found", "NOT_FOUND", 404));
    await render(<DoctorMessagesThreadScreen />);
    expect(await screen.findByText("Thread not found")).toBeTruthy();
  });

  it("sends a trimmed message", async () => {
    mockSend.mockResolvedValue(message);
    await render(<DoctorMessagesThreadScreen />);
    const input = await screen.findByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "  Take rest and drink water  ");
    await fireEvent.press(screen.getByTestId("chat-send-button"));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith("thread-1", "Take rest and drink water");
    });
  });

  it("exposes the send button to assistive technology by its accessible name", async () => {
    mockSend.mockResolvedValue(message);
    await render(<DoctorMessagesThreadScreen />);
    const input = await screen.findByLabelText("Type a message");
    await fireEvent.changeText(input, "Take rest and drink water");

    await fireEvent.press(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith("thread-1", "Take rest and drink water");
    });
  });

  it("restores the draft and shows an error when sending fails", async () => {
    mockSend.mockRejectedValue(new ApiRequestError("Thread closed", "CLOSED", 400));
    await render(<DoctorMessagesThreadScreen />);
    const input = await screen.findByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "Are you there?");
    await fireEvent.press(screen.getByTestId("chat-send-button"));

    expect(await screen.findByText("Thread closed")).toBeTruthy();
    expect(input.props.value).toBe("Are you there?");
  });

  it("does not double-send when the send button is pressed twice back-to-back before the request resolves", async () => {
    let resolveSend: (v: unknown) => void;
    mockSend.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    await render(<DoctorMessagesThreadScreen />);
    const input = await screen.findByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "Take rest");

    const sendButton = screen.getByTestId("chat-send-button");
    await act(async () => {
      fireEvent.press(sendButton);
      fireEvent.press(sendButton);
      resolveSend!(message);
      await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    });
  });

  it("does not let a slower initial load overwrite a faster, later poll response (out-of-order responses)", async () => {
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
      mockListMessages.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

      await render(<DoctorMessagesThreadScreen />); // fires request A (initial load), pending

      await act(async () => {
        jest.advanceTimersByTime(5000); // POLL_MS — fires the interval tick -> request B, pending
      });

      const newMessage = { ...message, id: "new-1", body: "New: patient is stable now" };
      await act(async () => {
        resolveB!({ messages: [newMessage], hasMore: false }); // B (newer) resolves first
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText("New: patient is stable now")).toBeTruthy());

      const oldMessage = { ...message, id: "old-1", body: "Old: stale patient update" };
      await act(async () => {
        resolveA!({ messages: [oldMessage], hasMore: false }); // A (older) resolves late
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText("New: patient is stable now")).toBeTruthy();
      expect(screen.queryByText("Old: stale patient update")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not let a stale, late-failing request clobber state after a newer request already succeeded", async () => {
    jest.useFakeTimers();
    try {
      let rejectA: (e: unknown) => void;
      let resolveB: (v: unknown) => void;
      const requestA = new Promise((_resolve, reject) => {
        rejectA = reject;
      });
      const requestB = new Promise((resolve) => {
        resolveB = resolve;
      });
      mockListMessages.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

      await render(<DoctorMessagesThreadScreen />); // request A (initial load), pending

      await act(async () => {
        jest.advanceTimersByTime(5000); // POLL_MS — fires the interval tick -> request B, pending
      });

      const newMessage = { ...message, id: "new-2", body: "New: patient update after poll" };
      await act(async () => {
        resolveB!({ messages: [newMessage], hasMore: false }); // B (newer) succeeds first
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText("New: patient update after poll")).toBeTruthy());

      await act(async () => {
        rejectA!(new ApiRequestError("Thread not found", "NOT_FOUND", 404)); // A (older) fails late
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText("New: patient update after poll")).toBeTruthy();
      expect(screen.queryByText("Thread not found")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
