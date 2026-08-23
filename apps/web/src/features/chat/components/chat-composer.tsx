"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";

type ChatComposerProps = {
  onSend: (body: string) => Promise<void>;
  onSendVoiceNote?: (blob: Blob) => Promise<void>;
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
  placeholder,
  disabled,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
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
    } catch {
      setMicError("Microphone access denied");
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

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });

    stopStream();
    mediaRecorderRef.current = null;
    setIsRecording(false);

    if (blob.size === 0) return;
    setSending(true);
    try {
      await onSendVoiceNote?.(blob);
    } finally {
      setSending(false);
    }
  }

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
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 items-end gap-2 border-t border-slate-200/80 bg-[#f0f2f5] px-3 py-3 sm:px-4"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={micError ?? placeholder}
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
  );
}
