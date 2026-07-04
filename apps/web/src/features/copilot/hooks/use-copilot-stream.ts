"use client";

import { useCallback, useRef } from "react";
import type { CopilotMessageDto, CopilotStreamEvent } from "@/features/copilot/types";
import type { CopilotMessageMetadata } from "@zindagi/validators";

type StreamCallbacks = {
  onToken: (text: string) => void;
  onMetadata: (metadata: CopilotMessageMetadata) => void;
  onDone: (message: CopilotMessageDto) => void;
  onError: (message: string) => void;
};

export function useCopilotStream() {
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      sessionId: string,
      content: string,
      locale: "en" | "ur",
      callbacks: StreamCallbacks,
      inputMode: "voice" | "text" = "text",
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`/api/v1/copilot/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, locale, inputMode }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        callbacks.onError(
          (json as { error?: { message?: string } })?.error?.message ??
            "Failed to send message",
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "message";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim();
            }
          }

          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine) as CopilotStreamEvent;
            if (eventType === "token" || parsed.type === "token") {
              callbacks.onToken(parsed.type === "token" ? parsed.text : "");
            } else if (eventType === "metadata" || parsed.type === "metadata") {
              if (parsed.type === "metadata") callbacks.onMetadata(parsed.metadata);
            } else if (eventType === "done" || parsed.type === "done") {
              if (parsed.type === "done") callbacks.onDone(parsed.message);
            } else if (eventType === "error" || parsed.type === "error") {
              callbacks.onError(parsed.type === "error" ? parsed.message : "Error");
            }
          } catch {
            // Ignore malformed events.
          }
        }
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, cancel };
}
