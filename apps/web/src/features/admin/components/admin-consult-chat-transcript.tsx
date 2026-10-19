"use client";

import { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { cn } from "@zindagi/shared";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import type { AdminChatTranscriptDto } from "@/features/chat/types";

type Message = AdminChatTranscriptDto["messages"][number];

function Attachment({ url, mime }: { url: string; mime?: string }) {
  if (mime?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Chat attachment" className="max-h-48 rounded-md border border-slate-200" />
      </a>
    );
  }
  if (mime?.startsWith("audio/")) {
    return <audio controls src={url} className="mt-1 h-9 max-w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
    >
      <Paperclip className="h-3.5 w-3.5" />
      Open attachment
    </a>
  );
}

function MessageRow({
  message,
  patientName,
  doctorName,
}: {
  message: Message;
  patientName: string;
  doctorName: string;
}) {
  if (message.sender === "system") {
    return (
      <div className="mx-auto max-w-[90%] rounded-md bg-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
        <p className="whitespace-pre-line">{message.body}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{formatKarachiDateTime(message.createdAt)}</p>
      </div>
    );
  }

  const isDoctor = message.sender === "doctor";
  return (
    <div className={cn("flex", isDoctor ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isDoctor
            ? "bg-brand/10 text-slate-800"
            : "border border-slate-200 bg-white text-slate-800",
        )}
      >
        <p className="text-[11px] font-semibold text-slate-500">
          {isDoctor ? doctorName : patientName}
        </p>
        {message.body ? <p className="whitespace-pre-line break-words">{message.body}</p> : null}
        {message.attachmentUrl ? (
          <Attachment url={message.attachmentUrl} mime={message.attachmentMime} />
        ) : null}
        <p className="mt-1 text-[10px] text-slate-400">{formatKarachiDateTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

/** Collapsible, read-only doctor–patient chat for one appointment; loads on first open. */
export function AdminConsultChatTranscript({
  appointmentId,
  patientName,
  doctorName,
}: {
  appointmentId: string;
  patientName: string;
  doctorName: string;
}) {
  const [transcript, setTranscript] = useState<AdminChatTranscriptDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (transcript || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/appointments/${appointmentId}/chat`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Could not load the chat.");
      } else {
        setTranscript(json.data);
      }
    } catch {
      setError("Could not load the chat.");
    }
    setLoading(false);
  };

  const count = transcript?.messages.filter((m) => m.sender !== "system").length;

  return (
    <details
      className="group mt-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) void load();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 hover:text-brand [&::-webkit-details-marker]:hidden">
        <span>
          Doctor–patient chat
          {count !== undefined ? ` · ${count}` : ""}
        </span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">
        {loading ? (
          <p className="text-sm text-slate-400">Loading chat…</p>
        ) : error ? (
          <p className="text-sm text-rose-700">
            {error}{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                setError(null);
                void load();
              }}
            >
              Retry
            </button>
          </p>
        ) : transcript && transcript.messages.length > 0 ? (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {transcript.truncated && (
              <p className="text-center text-xs text-slate-400">Showing the latest messages only.</p>
            )}
            {transcript.messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                patientName={patientName}
                doctorName={doctorName}
              />
            ))}
          </div>
        ) : transcript ? (
          <p className="text-sm text-slate-400">No messages exchanged yet.</p>
        ) : null}
      </div>
    </details>
  );
}
