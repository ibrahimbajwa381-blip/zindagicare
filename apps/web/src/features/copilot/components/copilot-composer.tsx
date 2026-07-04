"use client";

import { useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";

type CopilotComposerProps = {
  onSend: (body: string) => Promise<void>;
  placeholder: string;
  disabled?: boolean;
  listening?: boolean;
  onMicClick?: () => void;
  micLabel?: string;
  stopMicLabel?: string;
};

/** Voice-first composer — type a message or tap mic when the input is empty. */
export function CopilotComposer({
  onSend,
  placeholder,
  disabled,
  listening = false,
  onMicClick,
  micLabel = "Voice message",
  stopMicLabel = "Stop recording",
}: CopilotComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const hasText = text.trim().length > 0;

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

  return (
    <div className="shrink-0 border-t border-slate-200/70 bg-white/90 px-3 py-3 backdrop-blur-sm sm:px-4 pb-safe">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-2.5">
        <div
          className={cn(
            "flex min-h-[46px] flex-1 items-end rounded-2xl border bg-white shadow-sm transition-shadow",
            listening
              ? "border-red-300 ring-2 ring-red-100"
              : "border-slate-200 focus-within:border-brand-light focus-within:ring-2 focus-within:ring-brand-muted",
          )}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={1}
            disabled={disabled || sending || listening}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            className={cn(
              "max-h-32 min-h-[44px] w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-sm leading-relaxed",
              "outline-none placeholder:text-slate-400",
            )}
          />
        </div>

        {hasText ? (
          <Button
            type="submit"
            size="icon"
            disabled={sending || disabled}
            className="h-11 w-11 shrink-0 rounded-full bg-brand shadow-md shadow-brand/25 hover:bg-brand-dark"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            disabled={disabled || sending}
            onClick={onMicClick}
            className={cn(
              "relative h-11 w-11 shrink-0 rounded-full shadow-md",
              listening
                ? "bg-red-500 shadow-red-500/25 hover:bg-red-600"
                : "bg-brand shadow-brand/25 hover:bg-brand-dark",
            )}
            aria-label={listening ? stopMicLabel : micLabel}
          >
            {listening ? (
              <>
                <span
                  className="absolute inset-0 animate-ping rounded-full bg-red-400/40"
                  aria-hidden
                />
                <MicOff className="relative h-4 w-4" />
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
      </form>
    </div>
  );
}
