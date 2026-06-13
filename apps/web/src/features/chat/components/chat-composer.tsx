"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";

type ChatComposerProps = {
  onSend: (body: string) => Promise<void>;
  placeholder: string;
  disabled?: boolean;
};

export function ChatComposer({ onSend, placeholder, disabled }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || disabled) return;

    setSending(true);
    try {
      await onSend(body);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 items-end gap-2 border-t border-slate-200/80 bg-[#f0f2f5] px-3 py-3 sm:px-4"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={1}
        disabled={disabled || sending}
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
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || sending || disabled}
        className="h-11 w-11 shrink-0 rounded-full bg-brand hover:bg-brand-dark"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
