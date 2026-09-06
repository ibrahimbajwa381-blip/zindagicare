import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import {
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { VoiceRecorderButton } from "@/components/chat/voice-recorder-button";
import { uploadChatVoiceNote } from "@/api/chat";

jest.mock("@/api/chat");

const mockRequestPermission = requestRecordingPermissionsAsync as jest.Mock;
const mockUseAudioRecorderState = useAudioRecorderState as jest.Mock;
const mockUseAudioRecorder = useAudioRecorder as jest.Mock;
const mockUploadVoiceNote = uploadChatVoiceNote as jest.Mock;

describe("VoiceRecorderButton", () => {
  beforeEach(() => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: false, durationMillis: 0 });
  });

  it("requests permission and starts recording when the mic button is pressed", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    const recorder = { prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), isRecording: false, uri: null };
    mockUseAudioRecorder.mockReturnValue(recorder);
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);
    await fireEvent.press(screen.root!);

    await waitFor(() => {
      expect(recorder.prepareToRecordAsync).toHaveBeenCalled();
      expect(recorder.record).toHaveBeenCalled();
    });
  });

  it("alerts when microphone permission is denied", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);
    await fireEvent.press(screen.root!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Microphone access needed",
        "Enable microphone access in Settings to send voice notes.",
      );
    });
  });

  it("shows the recording UI with elapsed time when recording", async () => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: true, durationMillis: 65_000 });
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);
    expect(screen.getByText("1:05")).toBeTruthy();
  });

  it("cancels the recording without uploading", async () => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: true, durationMillis: 3000 });
    const recorder = {
      prepareToRecordAsync: jest.fn(),
      record: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      isRecording: true,
      uri: "file://x.m4a",
    };
    mockUseAudioRecorder.mockReturnValue(recorder);
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);

    await fireEvent.press(screen.getByTestId("voice-recorder-cancel"));

    await waitFor(() => expect(recorder.stop).toHaveBeenCalled());
    expect(mockUploadVoiceNote).not.toHaveBeenCalled();
  });

  it("stops recording, uploads, and reports the voice note", async () => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: true, durationMillis: 3000 });
    const recorder = {
      prepareToRecordAsync: jest.fn(),
      record: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      isRecording: true,
      uri: "file://voice.m4a",
    };
    mockUseAudioRecorder.mockReturnValue(recorder);
    mockUploadVoiceNote.mockResolvedValue({ storageKey: "k", url: "/v.m4a", mimeType: "audio/mp4" });
    const onUploaded = jest.fn();
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={onUploaded} />);

    await fireEvent.press(screen.getByTestId("voice-recorder-send"));

    await waitFor(() => {
      expect(recorder.stop).toHaveBeenCalled();
      expect(mockUploadVoiceNote).toHaveBeenCalledWith("thread-1", "file://voice.m4a", "audio/mp4");
      expect(onUploaded).toHaveBeenCalledWith({ url: "/v.m4a", mime: "audio/mp4" });
    });
  });

  it("alerts when uploading the voice note fails", async () => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: true, durationMillis: 3000 });
    const recorder = {
      prepareToRecordAsync: jest.fn(),
      record: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      isRecording: true,
      uri: "file://voice.m4a",
    };
    mockUseAudioRecorder.mockReturnValue(recorder);
    mockUploadVoiceNote.mockRejectedValue(new Error("boom"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);

    await fireEvent.press(screen.getByTestId("voice-recorder-send"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't send voice note", "Please try again.");
    });
  });

  it("exposes a meaningful accessible name for the mic button (icon-only)", async () => {
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Record a voice note" })).toBeTruthy();
  });

  it("exposes meaningful accessible names for the cancel and send buttons while recording (icon-only)", async () => {
    mockUseAudioRecorderState.mockReturnValue({ isRecording: true, durationMillis: 3000 });
    await render(<VoiceRecorderButton threadId="thread-1" onUploaded={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Cancel voice note" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send voice note" })).toBeTruthy();
  });
});
