"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Paperclip, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";
import {
  recordingErrorMessage,
  voiceNoteMimeType,
} from "@/features/chat/lib/voice-note-format";
import { ChatRequestError } from "@/features/chat/lib/chat-api";
import { preparePhotoUpload } from "@/lib/ui/prepare-photo-upload";

// Vercel rejects request bodies over 4.5 MB before they reach the route; leave room for multipart overhead.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const VOICE_NOTE_BITS_PER_SECOND = 32_000;
const ACCEPTED_FILE_TYPES =
  "image/png,image/jpeg,image/webp,image/heic,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ChatComposerProps = {
  onSend: (body: string) => Promise<void>;
  onSendVoiceNote?: (blob: Blob) => Promise<void>;
  onSendFile?: (file: File) => Promise<void>;
  placeholder: string;
  disabled?: boolean;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChatComposer({
  onSend,
  onSendVoiceNote,
  onSendFile,
  placeholder,
  disabled,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Kept after a failed send so the user can retry without re-recording.
  const [failedVoiceNote, setFailedVoiceNote] = useState<Blob | null>(null);
  const [voiceSendError, setVoiceSendError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked || !onSendFile || disabled) return;

    setFileError(null);
    setSending(true);
    try {
      const file = await preparePhotoUpload(picked);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFileError("File must be 4 MB or smaller");
        return;
      }
      await onSendFile(file);
    } catch (error) {
      setFileError(
        error instanceof ChatRequestError ? `Couldn't send file: ${error.message}` : "Couldn't send file",
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || disabled) return;

    setSending(true);
    setText("");
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    if (disabled || !onSendVoiceNote) return;
    setMicError(null);
    setFailedVoiceNote(null);
    setVoiceSendError(null);
    if (!window.isSecureContext || !navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setMicError(recordingErrorMessage(null, window.isSecureContext));
      return;
    }
    try {
      // Mono speech at 32 kbps (Opus/AAC) is ~4x smaller than the browser default and still clear.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: VOICE_NOTE_BITS_PER_SECOND });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (error) {
      stopStream();
      setMicError(recordingErrorMessage(error, window.isSecureContext));
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stopStream();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  async function stopAndSendRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const mimeType = voiceNoteMimeType(recorder.mimeType || chunksRef.current[0]?.type);
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mimeType ?? "" }));
      };
      recorder.stop();
    });

    stopStream();
    mediaRecorderRef.current = null;
    setIsRecording(false);

    if (!mimeType) {
      setMicError("This browser records voice in an unsupported format");
      return;
    }
    if (blob.size === 0) {
      setMicError("Nothing was recorded. Please try again");
      return;
    }
    await sendVoiceNote(blob);
  }

  async function sendVoiceNote(blob: Blob) {
    if (!onSendVoiceNote) return;
    setSending(true);
    setFailedVoiceNote(null);
    setVoiceSendError(null);
    try {
      await onSendVoiceNote(blob);
    } catch (error) {
      if (error instanceof ChatRequestError && !error.retryable) {
        // Wrong type/size or auth: retrying the same recording can't succeed.
        setVoiceSendError(`Voice note not sent: ${error.message}`);
      } else {
        setVoiceSendError(
          error instanceof ChatRequestError ? `Voice note failed to send. ${error.message}` : "Voice note failed to send",
        );
        setFailedVoiceNote(blob);
      }
    } finally {
      setSending(false);
    }
  }

  const errorMessage = voiceSendError ?? micError ?? fileError;

  if (isRecording) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200/80 bg-[#f0f2f5] px-3 py-3 sm:px-4">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={cancelRecording}
          className="h-11 w-11 shrink-0 rounded-full text-red-500 hover:bg-red-50"
          aria-label="Cancel recording"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm font-medium text-slate-700">
            {formatDuration(recordSeconds)}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          onClick={() => void stopAndSendRecording()}
          disabled={sending}
          className="h-11 w-11 shrink-0 rounded-full bg-brand hover:bg-brand-dark"
          aria-label="Stop and send voice note"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
    {errorMessage && (
      <div
        role="alert"
        className="flex shrink-0 items-center gap-3 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700"
      >
        <span className="flex-1">{errorMessage}</span>
        {failedVoiceNote && (
          <>
            <button
              type="button"
              disabled={sending}
              onClick={() => void sendVoiceNote(failedVoiceNote)}
              className="font-medium underline disabled:opacity-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                setFailedVoiceNote(null);
                setVoiceSendError(null);
              }}
              className="text-red-500"
            >
              Discard
            </button>
          </>
        )}
      </div>
    )}
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 items-end gap-2 border-t border-slate-200/80 bg-[#f0f2f5] px-3 py-3 sm:px-4"
    >
      {onSendFile && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => void handleFilePicked(e)}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={sending || disabled}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 w-11 shrink-0 rounded-full text-slate-500 hover:bg-slate-200/70"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit(e);
          }
        }}
        className={cn(
          "max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm",
          "outline-none transition-shadow focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
        )}
      />
      {text.trim() ? (
        <Button
          type="submit"
          size="icon"
          disabled={sending || disabled}
          className="h-11 w-11 shrink-0 rounded-full bg-brand hover:bg-brand-dark"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      ) : (
        onSendVoiceNote && (
          <Button
            type="button"
            size="icon"
            disabled={sending || disabled}
            onClick={() => void startRecording()}
            className="h-11 w-11 shrink-0 rounded-full bg-brand hover:bg-brand-dark"
            aria-label="Record voice note"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )
      )}
    </form>
    </>
  );
}
