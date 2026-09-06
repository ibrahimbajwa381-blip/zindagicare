import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import MessagesThreadScreen from "@app/messages/[threadId]";
import { listChatMessages, markChatThreadRead, sendChatMessage } from "@/api/chat";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/chat");
jest.mock("@/components/chat/file-attachment-button", () => {
  const { Text } = require("react-native");
  return { FileAttachmentButton: () => <Text>FileAttachmentButtonStub</Text> };
});
jest.mock("@/components/chat/voice-recorder-button", () => {
  const { Text } = require("react-native");
  return { VoiceRecorderButton: () => <Text>VoiceRecorderButtonStub</Text> };
});
jest.mock("@/components/chat/attachment-bubble", () => {
  const { Text } = require("react-native");
  return { AttachmentBubble: ({ mime }: { mime: string }) => <Text>Attachment:{mime}</Text> };
});
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockListMessages = listChatMessages as jest.Mock;
const mockMarkRead = markChatThreadRead as jest.Mock;
const mockSend = sendChatMessage as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const message = {
  id: "m1",
  threadId: "thread-1",
  senderId: "doc-1",
  kind: "user" as const,
  body: "Hello, how are you feeling?",
  createdAt: "2026-01-01T05:00:00.000Z",
  isMine: false,
  readBy: [],
};

describe("MessagesThreadScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-1", name: "Dr. Sara Ahmed" });
    mockListMessages.mockResolvedValue({ messages: [message], hasMore: false });
    mockMarkRead.mockResolvedValue({ ok: true });
  });

  it("redirects to login instead of rendering the thread when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<MessagesThreadScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<MessagesThreadScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("loads and renders messages, marking the thread read", async () => {
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByText("Hello, how are you feeling?")).toBeTruthy());
    expect(mockMarkRead).toHaveBeenCalledWith("thread-1");
  });

  it("shows the empty state when there are no messages", async () => {
    mockListMessages.mockResolvedValue({ messages: [], hasMore: false });
    await render(<MessagesThreadScreen />);
    expect(await screen.findByText("No messages yet. Say hello.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockListMessages.mockRejectedValue(new ApiRequestError("Thread not found", "NOT_FOUND", 404));
    await render(<MessagesThreadScreen />);
    expect(await screen.findByText("Thread not found")).toBeTruthy();
  });

  it("renders an attachment bubble instead of text for attachment messages", async () => {
    mockListMessages.mockResolvedValue({
      messages: [{ ...message, body: "", attachmentUrl: "/f.png", attachmentMime: "image/png" }],
      hasMore: false,
    });
    await render(<MessagesThreadScreen />);
    expect(await screen.findByText("Attachment:image/png")).toBeTruthy();
  });

  it("hides the attachment/voice buttons and shows send once text is entered", async () => {
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByText("FileAttachmentButtonStub")).toBeTruthy());
    expect(screen.getByText("VoiceRecorderButtonStub")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "Hi doctor");
    expect(screen.queryByText("FileAttachmentButtonStub")).toBeNull();
    expect(screen.queryByText("VoiceRecorderButtonStub")).toBeNull();
  });

  it("sends a trimmed message and clears the input", async () => {
    mockSend.mockResolvedValue(message);
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());

    const input = screen.getByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "  Feeling better today  ");
    await fireEvent.press(screen.getByTestId("chat-send-button"));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith("thread-1", "Feeling better today");
    });
    expect(input.props.value).toBe("");
  });

  it("exposes the send button to assistive technology by its accessible name", async () => {
    mockSend.mockResolvedValue(message);
    await render(<MessagesThreadScreen />);
    const input = await screen.findByLabelText("Type a message");
    await fireEvent.changeText(input, "Feeling better today");

    await fireEvent.press(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith("thread-1", "Feeling better today");
    });
  });

  it("restores the draft and shows an error when sending fails", async () => {
    mockSend.mockRejectedValue(new ApiRequestError("Thread closed", "CLOSED", 400));
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());

    const input = screen.getByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "Are you there?");
    await fireEvent.press(screen.getByTestId("chat-send-button"));

    expect(await screen.findByText("Thread closed")).toBeTruthy();
    expect(input.props.value).toBe("Are you there?");
  });

  it("does not send an empty or whitespace-only message", async () => {
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());
    const input = screen.getByPlaceholderText("Type a message");
    await fireEvent.changeText(input, "   ");
    expect(screen.queryByTestId("chat-send-button")).toBeNull();
  });

  it("does not double-send when the send button is pressed twice back-to-back before the request resolves", async () => {
    let resolveSend: (v: unknown) => void;
    mockSend.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "Hello");

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

      await render(<MessagesThreadScreen />); // fires request A (initial load), pending

      await act(async () => {
        jest.advanceTimersByTime(5000); // POLL_MS — fires the interval tick -> request B, pending
      });

      const newMessage = { ...message, id: "new-1", body: "New: feeling much better" };
      await act(async () => {
        resolveB!({ messages: [newMessage], hasMore: false }); // B (newer) resolves first
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText("New: feeling much better")).toBeTruthy());

      const oldMessage = { ...message, id: "old-1", body: "Old: stale symptom text" };
      await act(async () => {
        resolveA!({ messages: [oldMessage], hasMore: false }); // A (older) resolves late
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText("New: feeling much better")).toBeTruthy();
      expect(screen.queryByText("Old: stale symptom text")).toBeNull();
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

      await render(<MessagesThreadScreen />); // request A (initial load), pending

      await act(async () => {
        jest.advanceTimersByTime(5000); // POLL_MS — fires the interval tick -> request B, pending
      });

      const newMessage = { ...message, id: "new-2", body: "New: still feeling better" };
      await act(async () => {
        resolveB!({ messages: [newMessage], hasMore: false }); // B (newer) succeeds first
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText("New: still feeling better")).toBeTruthy());

      await act(async () => {
        rejectA!(new ApiRequestError("Thread not found", "NOT_FOUND", 404)); // A (older) fails late
        await Promise.resolve();
        await Promise.resolve();
      });

      // The stale error must not replace the already-loaded newer messages with an error screen.
      expect(screen.getByText("New: still feeling better")).toBeTruthy();
      expect(screen.queryByText("Thread not found")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("renders a large (500-message) inverted chat list through the real component tree without crashing", async () => {
    const largeThread = Array.from({ length: 500 }, (_, i) => ({
      ...message,
      id: `m-${i}`,
      body: i === 250 ? "" : `Message number ${i}`, // edge case: empty body mid-thread
      isMine: i % 2 === 0,
      attachmentUrl: i > 0 && i % 50 === 0 ? "/voice.mp4" : undefined,
      attachmentMime: i > 0 && i % 50 === 0 ? "audio/mp4" : undefined,
    }));
    mockListMessages.mockResolvedValue({ messages: largeThread, hasMore: false });

    await render(<MessagesThreadScreen />);

    // The real renderItem (text bubble vs. attachment bubble) must run against the full
    // 500-message dataset without the inverted FlatList crashing or hanging.
    expect(await screen.findByText("Message number 0")).toBeTruthy();
    expect(screen.getByText("Message number 1")).toBeTruthy();
  });

  it("sends a very long message after a large history without duplicating on a rapid double-tap", async () => {
    const largeThread = Array.from({ length: 500 }, (_, i) => ({
      ...message,
      id: `m-${i}`,
      body: `Message number ${i}`,
      isMine: i % 2 === 0,
    }));
    mockListMessages.mockResolvedValue({ messages: largeThread, hasMore: false });
    let resolveSend: (v: unknown) => void;
    mockSend.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );

    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message")).toBeTruthy());

    const longMessage = "B".repeat(1000);
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), longMessage);

    const sendButton = screen.getByTestId("chat-send-button");
    await act(async () => {
      fireEvent.press(sendButton);
      fireEvent.press(sendButton); // rapid double-tap on top of a 500-message history
      resolveSend!(message);
      await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    });
    expect(mockSend).toHaveBeenCalledWith("thread-1", longMessage);
  });
});
