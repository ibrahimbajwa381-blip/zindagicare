"use client";

import { useCallback, useRef, useState } from "react";
import {
  detectMessageLanguage,
  toLegacyLocale,
} from "@/features/copilot/lib/detect-message-locale";

type UseCopilotVoiceOptions = {
  locale: "en" | "ur";
  onTranscript: (text: string, detectedLocale: "en" | "ur") => void;
  onError?: (message: string) => void;
};

// Minimal Web Speech API types for browsers that support voice input.
interface SpeechRecognitionResultLike {
  0?: { transcript?: string };
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike[];
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useCopilotVoice({ locale, onTranscript, onError }: UseCopilotVoiceOptions) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopListening = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const transcribeWithServer = useCallback(
    async (blob: Blob) => {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("locale", locale);

      const res = await fetch("/api/v1/copilot/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!json.success || !json.data?.text) {
        throw new Error(json.error?.message ?? "Transcription failed");
      }
      onTranscript(
        json.data.text as string,
        toLegacyLocale(detectMessageLanguage(json.data.text as string)),
      );
    },
    [locale, onTranscript],
  );

  const startListening = useCallback(async () => {
    if (listening) {
      stopListening();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = locale === "ur" ? "ur-PK" : "en-PK";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
          const text = event.results[0]?.[0]?.transcript?.trim();
          if (text) onTranscript(text, toLegacyLocale(detectMessageLanguage(text)));
          setListening(false);
        };
        recognition.onerror = () => {
          setListening(false);
          onError?.(locale === "ur" ? "آواز سمجھ نہیں آئی" : "Could not understand voice");
        };
        recognition.onend = () => setListening(false);

        setListening(true);
        recognition.start();
        return;
      } catch {
        // Fall through to MediaRecorder + server STT.
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) return;
        try {
          await transcribeWithServer(blob);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "Transcription failed");
        }
      };

      setListening(true);
      recorder.start();
    } catch {
      onError?.(
        locale === "ur"
          ? "مائیکروفون کی اجازت درکار ہے"
          : "Microphone permission is required",
      );
    }
  }, [listening, locale, onError, onTranscript, stopListening, transcribeWithServer]);

  const speakText = useCallback(
    async (text: string, speakLocale?: "en" | "ur") => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const voiceLocale = speakLocale ?? toLegacyLocale(detectMessageLanguage(trimmed));

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(trimmed);
          utterance.lang = voiceLocale === "ur" ? "ur-PK" : "en-US";
          setSpeaking(true);
          utterance.onend = () => {
            setSpeaking(false);
            resolve();
          };
          utterance.onerror = () => {
            setSpeaking(false);
            resolve();
          };
          window.speechSynthesis.speak(utterance);
        });
      }
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  return {
    listening,
    speaking,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}
