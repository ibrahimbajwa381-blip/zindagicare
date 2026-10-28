import {
  recordingErrorMessage,
  voiceNoteFileName,
  voiceNoteMimeType,
} from "@/features/chat/lib/voice-note-format";

function domError(name: string) {
  const error = new Error("raw browser text");
  error.name = name;
  return error;
}

describe("voiceNoteMimeType", () => {
  test.each([
    ["audio/webm;codecs=opus", "audio/webm"], // Chrome / Firefox
    ["audio/mp4", "audio/mp4"], // Safari
    ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
    ["Audio/Ogg; codecs=opus", "audio/ogg"],
    ["video/webm;codecs=opus", "audio/webm"],
    ["video/mp4", "audio/mp4"],
    ["audio/mpeg", "audio/mpeg"],
  ])("%s -> %s", (input, expected) => {
    expect(voiceNoteMimeType(input)).toBe(expected);
  });

  test.each([[""], [undefined], ["audio/wav"], ["audio/x-caf"], ["text/plain"]])(
    "unsupported or missing %p -> null",
    (input) => {
      expect(voiceNoteMimeType(input)).toBeNull();
    },
  );
});

describe("voiceNoteFileName", () => {
  test("extension matches the real type, including Safari's audio/mp4", () => {
    expect(voiceNoteFileName("audio/webm")).toBe("voice-note.webm");
    expect(voiceNoteFileName("audio/mp4")).toBe("voice-note.m4a");
    expect(voiceNoteFileName("audio/ogg")).toBe("voice-note.ogg");
    expect(voiceNoteFileName("audio/mpeg")).toBe("voice-note.mp3");
  });
});

describe("recordingErrorMessage", () => {
  test("insecure page explains https instead of 'denied'", () => {
    expect(recordingErrorMessage(null, false)).toMatch(/https/);
  });

  test("maps browser error names to clear messages without raw text", () => {
    expect(recordingErrorMessage(domError("NotAllowedError"), true)).toMatch(/blocked/i);
    expect(recordingErrorMessage(domError("NotFoundError"), true)).toBe("No microphone found");
    expect(recordingErrorMessage(domError("NotReadableError"), true)).toMatch(/in use/);
    expect(recordingErrorMessage(new TypeError("x"), true)).toBe("Couldn't start recording");
    expect(recordingErrorMessage(domError("NotAllowedError"), true)).not.toContain("raw browser text");
  });
});
