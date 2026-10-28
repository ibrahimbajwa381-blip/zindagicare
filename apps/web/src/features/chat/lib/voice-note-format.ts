// Must stay within the audio types the server accepts (chat-attachment.storage.ts).
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

/**
 * Normalizes what MediaRecorder reports ("audio/webm;codecs=opus", Safari's
 * "audio/mp4", sometimes "" or "video/webm" from Chrome) to a server-accepted
 * audio type, or null when the browser recorded something we can't send.
 */
export function voiceNoteMimeType(recorderMime: string | undefined): string | null {
  const base = (recorderMime ?? "").split(";")[0].trim().toLowerCase();
  if (!base) return null;
  // Chrome may label audio-only recordings as video/webm.
  const audio = base === "video/webm" ? "audio/webm" : base === "video/mp4" ? "audio/mp4" : base;
  return audio in AUDIO_EXTENSIONS ? audio : null;
}

export function voiceNoteFileName(mimeType: string): string {
  return `voice-note.${AUDIO_EXTENSIONS[mimeType] ?? "webm"}`;
}

/** User-facing reason recording could not start; no raw browser error text. */
export function recordingErrorMessage(error: unknown, secureContext: boolean): string {
  if (!secureContext) return "Voice notes need a secure (https) connection";
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone blocked. Allow microphone access in your browser settings";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found";
  }
  if (name === "NotReadableError") return "Microphone is in use by another app";
  return "Couldn't start recording";
}
