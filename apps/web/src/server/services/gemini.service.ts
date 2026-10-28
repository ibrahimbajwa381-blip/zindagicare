import { AppError } from "@zindagi/shared";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LlmToolCall[];
};

export type LlmTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type LlmCompletionResult = {
  content: string;
  toolCalls: LlmToolCall[];
};

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

function getApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) {
    throw new AppError(
      "AI assistant is not configured",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }
  return key;
}

export function getGeminiApiKey(): string {
  return getApiKey();
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function isCopilotEnabled(): boolean {
  if (process.env.COPILOT_ENABLED === "false") return false;
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
}

function toGeminiPayload(messages: LlmMessage[], tools?: LlmTool[]) {
  let systemInstruction: string | undefined;
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content ?? undefined;
      continue;
    }

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: msg.content ?? "" }],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const toolCall of msg.tool_calls ?? []) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args,
          },
        });
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name ?? "tool",
              response: { result: msg.content ?? "" },
            },
          },
        ],
      });
    }
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (tools?.length) {
    body.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      },
    ];
  }

  return body;
}

/** User-facing message for a Gemini call that ran past its time budget. */
export const GEMINI_TIMEOUT_MESSAGE =
  "The assistant took too long to respond. Please try again.";

/** Max silence (no response headers / no stream chunk) before a Gemini call is aborted. */
const GEMINI_IDLE_TIMEOUT_MS = 20_000;

export type LlmTurnResult = LlmCompletionResult & { finishReason?: string };

/**
 * Opt-in only: allowed thinkingBudget values differ per Gemini model, so the
 * model default is kept unless GEMINI_THINKING_BUDGET is explicitly set.
 */
function thinkingConfig(): Record<string, unknown> | undefined {
  const raw = process.env.GEMINI_THINKING_BUDGET?.trim();
  if (!raw) return undefined;
  const budget = Number(raw);
  return Number.isInteger(budget) ? { thinkingBudget: budget } : undefined;
}

/**
 * One model turn over streamGenerateContent: text parts are forwarded to
 * `onText` as they arrive, function calls are collected and returned.
 */
export async function streamGeminiTurn(
  messages: LlmMessage[],
  options: {
    tools?: LlmTool[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    onText?: (text: string) => void;
  } = {},
): Promise<LlmTurnResult> {
  const body = toGeminiPayload(messages, options.tools);
  const generationConfig = body.generationConfig as Record<string, unknown>;
  if (options.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }
  if (options.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = options.maxTokens;
  }
  const thinking = thinkingConfig();
  if (thinking) generationConfig.thinkingConfig = thinking;

  const idle = new AbortController();
  let idleTimer = setTimeout(() => idle.abort(), GEMINI_IDLE_TIMEOUT_MS);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => idle.abort(), GEMINI_IDLE_TIMEOUT_MS);
  };
  const signal = options.signal ? AbortSignal.any([options.signal, idle.signal]) : idle.signal;

  let content = "";
  const toolCalls: LlmToolCall[] = [];
  let finishReason: string | undefined;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let parsed: { candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }> };
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // Ignore malformed SSE chunks.
    }
    const candidate = parsed.candidates?.[0];
    if (candidate?.finishReason) finishReason = candidate.finishReason;
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text) {
        content += part.text;
        options.onText?.(part.text);
      }
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `${part.functionCall.name}-${toolCalls.length}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args ?? {}),
          },
        });
      }
    }
  };

  try {
    const model = getGeminiModel();
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${getApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new AppError(
        `AI service error (${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        "UPSTREAM_ERROR",
        502,
      );
    }

    if (!res.body) {
      throw new AppError("AI service returned empty stream", "UPSTREAM_ERROR", 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(handleLine);
    }
    handleLine(buffer);
  } catch (error) {
    if (idle.signal.aborted && !options.signal?.aborted) {
      throw new AppError(GEMINI_TIMEOUT_MESSAGE, "UPSTREAM_TIMEOUT", 504);
    }
    throw error;
  } finally {
    clearTimeout(idleTimer);
  }

  return { content: content.trim(), toolCalls, finishReason };
}
