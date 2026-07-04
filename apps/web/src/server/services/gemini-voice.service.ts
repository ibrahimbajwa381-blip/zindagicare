import { AppError } from "@zindagi/shared";
import { getGeminiApiKey, getGeminiModel } from "@/server/services/gemini.service";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  language: "en" | "ur",
): Promise<string> {
  const prompt =
    language === "ur"
      ? "Transcribe this audio exactly as spoken. The speaker may use Urdu script or Roman Urdu. Return only the transcription with no translation or commentary."
      : "Transcribe this audio exactly as spoken in English. Return only the transcription with no commentary.";

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${getGeminiModel()}:generateContent?key=${getGeminiApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "audio/webm",
                  data: audioBuffer.toString("base64"),
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new AppError(
      `Voice transcription failed (${res.status})${errText ? `: ${errText.slice(0, 120)}` : ""}`,
      "UPSTREAM_ERROR",
      502,
    );
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AppError("Could not understand audio", "UPSTREAM_ERROR", 502);
  }

  return text;
}

/** Gemini free tier has no TTS — client falls back to browser speech synthesis. */
export async function synthesizeSpeech(
  _text: string,
  _language: "en" | "ur",
): Promise<{ audioBase64: string; contentType: string }> {
  throw new AppError(
    "Server TTS unavailable — use browser speech",
    "SERVICE_UNAVAILABLE",
    503,
  );
}
