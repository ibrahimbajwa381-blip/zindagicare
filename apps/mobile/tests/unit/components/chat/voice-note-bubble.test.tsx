import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VoiceNoteBubble } from "@/components/chat/voice-note-bubble";
import { chatAttachmentSource } from "@/api/chat";

jest.mock("@/api/chat");

const mockChatAttachmentSource = chatAttachmentSource as jest.Mock;
const mockUseAudioPlayer = useAudioPlayer as jest.Mock;
const mockUseAudioPlayerStatus = useAudioPlayerStatus as jest.Mock;

describe("VoiceNoteBubble", () => {
  beforeEach(() => {
    mockChatAttachmentSource.mockResolvedValue({ uri: "https://api.example.com/v.m4a", headers: {} });
  });

  it("shows the remaining duration once the source resolves", async () => {
    mockUseAudioPlayerStatus.mockReturnValue({ playing: false, didJustFinish: false, duration: 42, currentTime: 0 });
    await render(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalledWith("/v.m4a"));
    expect(screen.getByText("0:42")).toBeTruthy();
  });

  it("plays when toggled while paused", async () => {
    mockUseAudioPlayerStatus.mockReturnValue({ playing: false, didJustFinish: false, duration: 10, currentTime: 0 });
    const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() };
    mockUseAudioPlayer.mockReturnValue(player);
    await render(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalled());

    await fireEvent.press(screen.root!);
    expect(player.play).toHaveBeenCalled();
  });

  it("pauses when toggled while playing", async () => {
    mockUseAudioPlayerStatus.mockReturnValue({ playing: true, didJustFinish: false, duration: 10, currentTime: 3 });
    const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() };
    mockUseAudioPlayer.mockReturnValue(player);
    await render(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalled());

    await fireEvent.press(screen.root!);
    expect(player.pause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it("seeks to the start and replays when toggled after finishing", async () => {
    mockUseAudioPlayerStatus.mockReturnValue({ playing: false, didJustFinish: true, duration: 10, currentTime: 10 });
    const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() };
    mockUseAudioPlayer.mockReturnValue(player);
    await render(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalled());

    await fireEvent.press(screen.root!);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalled();
  });

  it("exposes 'Play voice note' as the accessible name while paused, and 'Pause voice note' while playing", async () => {
    mockUseAudioPlayerStatus.mockReturnValue({ playing: false, didJustFinish: false, duration: 10, currentTime: 0 });
    const { rerender } = await render(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play voice note" })).toBeTruthy());

    mockUseAudioPlayerStatus.mockReturnValue({ playing: true, didJustFinish: false, duration: 10, currentTime: 3 });
    rerender(<VoiceNoteBubble url="/v.m4a" isMine={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause voice note" })).toBeTruthy());
  });
});
