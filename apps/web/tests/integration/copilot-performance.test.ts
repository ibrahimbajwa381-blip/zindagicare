/**
 * Copilot (Gemini assistant) latency + failure-handling audit.
 *
 * Drives the real messages route -> CopilotService -> copilot tools against an
 * in-memory MongoDB, with Gemini mocked at the `fetch` layer (both the
 * generateContent and streamGenerateContent endpoints) and doctor/slot lookups
 * mocked with a fixed delay. All timings here are MOCKED latencies: they show
 * structural behaviour (sequential vs parallel, buffered vs streamed), never
 * real Gemini or production numbers.
 *
 * Set COPILOT_PERF_OUT=<file> to append the captured metrics as JSON lines.
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
jest.mock("@/server/services/patient-profile.service", () => ({
  getPatientProfile: async () => ({
    user: { city: "Lahore", locale: "en" },
    profile: { allergies: [], chronicConditions: [] },
  }),
}));

jest.setTimeout(60_000);

const USER_ID = "507f1f77bcf86cd799439011";
const CHUNK_INTERVAL_MS = 100;
const QUESTION = "I have had a mild headache for two days, what should I do?";

type Turn = {
  latencyMs?: number;
  chunks?: string[];
  functionCall?: { name: string; args: Record<string, unknown> };
  finishReason?: string;
  httpStatus?: number;
  hang?: boolean;
};

type GeminiCall = { endpoint: "generate" | "stream"; signal?: AbortSignal | null; body: unknown };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function abortable(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

function installGeminiMock(script: Turn[]) {
  const calls: GeminiCall[] = [];
  const queue = [...script];
  const realFetch = global.fetch;

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("generativelanguage.googleapis.com")) {
      throw new Error(`Unexpected outbound fetch in test: ${new URL(url).host}`);
    }
    const endpoint = url.includes(":streamGenerateContent") ? "stream" : "generate";
    const signal = init?.signal ?? null;
    calls.push({ endpoint, signal, body: JSON.parse(String(init?.body ?? "{}")) });

    const turn = queue.shift() ?? { chunks: ["(script exhausted)"] };
    if (turn.hang) {
      await abortable(50_000, signal);
    }
    await abortable(turn.latencyMs ?? 0, signal);

    if (turn.httpStatus && turn.httpStatus >= 400) {
      return new Response("upstream exploded", { status: turn.httpStatus });
    }

    const chunks = turn.chunks ?? [];
    const finishReason = turn.finishReason ?? "STOP";
    const functionPart = turn.functionCall ? [{ functionCall: turn.functionCall }] : [];

    if (endpoint === "generate") {
      // Non-streaming: the model still spends the full generation time.
      await abortable(chunks.length * CHUNK_INTERVAL_MS, signal);
      const parts = [...chunks.map((text) => ({ text })), ...functionPart];
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts }, finishReason }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const encoder = new TextEncoder();
    const frame = (parts: unknown[], done: boolean) =>
      encoder.encode(
        `data: ${JSON.stringify({
          candidates: [{ content: { parts }, ...(done ? { finishReason } : {}) }],
        })}\r\n\r\n`,
      );
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (let i = 0; i < chunks.length; i += 1) {
            if (i > 0) await abortable(CHUNK_INTERVAL_MS, signal);
            controller.enqueue(frame([{ text: chunks[i] }], false));
          }
          controller.enqueue(frame(functionPart, true));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;

  return { calls, restore: () => (global.fetch = realFetch) };
}

type SseEvent = { event: string; data: Record<string, unknown>; atMs: number };

async function postQuestion(
  sessionId: string,
  content: string,
  options: { abortAfterMs?: number } = {},
) {
  const route = await import("@/app/api/v1/copilot/sessions/[id]/messages/route");
  const controller = new AbortController();
  const req = new NextRequest(`http://localhost/api/v1/copilot/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
    signal: controller.signal,
  });

  const started = performance.now();
  const res = await route.POST(req, { params: Promise.resolve({ id: sessionId }) });
  const events: SseEvent[] = [];
  if (!res.body) return { status: res.status, events, totalMs: performance.now() - started };

  if (options.abortAfterMs !== undefined) {
    setTimeout(() => controller.abort(), options.abortAfterMs);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const event = /^event: (.*)$/m.exec(part)?.[1] ?? "message";
        const data = /^data: (.*)$/m.exec(part)?.[1];
        if (data) events.push({ event, data: JSON.parse(data), atMs: performance.now() - started });
      }
      if (options.abortAfterMs !== undefined && controller.signal.aborted) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } catch {
    // Reader errors after a client abort are expected.
  }

  return { status: res.status, events, totalMs: performance.now() - started };
}

function summarize(name: string, result: Awaited<ReturnType<typeof postQuestion>>, extra: Record<string, unknown>) {
  const tokens = result.events.filter((e) => e.event === "token");
  const terminal = result.events.find((e) => e.event === "done" || e.event === "error");
  const metrics = {
    scenario: name,
    status: result.status,
    ttftMs: tokens[0] ? Math.round(tokens[0].atMs) : null,
    totalMs: Math.round(result.totalMs),
    tokenEvents: tokens.length,
    statusEvents: result.events.filter((e) => e.event === "status").length,
    terminal: terminal?.event ?? "none",
    ...extra,
  };
  if (process.env.COPILOT_PERF_OUT) {
    fs.appendFileSync(process.env.COPILOT_PERF_OUT, `${JSON.stringify(metrics)}\n`);
  }
  console.log(JSON.stringify(metrics));
  return metrics;
}

describe("Copilot assistant — latency and failure handling (mocked Gemini, in-memory MongoDB)", () => {
  let mongod: MongoMemoryServer;
  let dbOps = 0;
  let db: typeof import("@zindagi/database");

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("copilot_perf_test");
    // Hard guard: refuse to run against anything but the local in-memory server.
    expect(new URL(process.env.MONGODB_URI).hostname).toBe("127.0.0.1");
    process.env.GEMINI_API_KEY = "test-key";
    process.env.COPILOT_ENABLED = "true";
    process.env.COPILOT_RATE_LIMIT = "1000";
    delete process.env.GEMINI_THINKING_BUDGET;

    db = await import("@zindagi/database");
    await db.connectDatabase();
    // Build indexes up front so dbOps only counts the request's own operations.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    mongoose.set("debug", () => {
      dbOps += 1;
    });
  });

  afterAll(async () => {
    mongoose.set("debug", false);
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(() => {
    dbOps = 0;
    mockAuth.mockResolvedValue({ user: { id: USER_ID, roles: ["patient"] } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function newSession() {
    const session = await db.CopilotSessionModel.create({
      userId: USER_ID,
      locale: "en",
      status: db.CopilotSessionStatuses.ACTIVE,
      lastMessageAt: new Date(),
    });
    return session._id.toString();
  }

  it("normal answer: first token arrives before generation finishes, one Gemini call", async () => {
    const sessionId = await newSession();
    const gemini = installGeminiMock([
      { latencyMs: 300, chunks: ["Rest, ", "drink water, ", "and see a ", "doctor if ", "it persists."] },
    ]);
    dbOps = 0;
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();
    const body = gemini.calls[0].body as { contents: Array<{ parts: Array<{ text?: string }> }> };
    const questionCount = body.contents
      .flatMap((c) => c.parts.map((p) => p.text))
      .filter((t) => t === QUESTION).length;
    const m = summarize("normal", result, { geminiCalls: gemini.calls.length, dbOps, questionCount });

    expect(m.terminal).toBe("done");
    expect(gemini.calls).toHaveLength(1);
    expect(questionCount).toBe(1);
    // 300ms latency + 4 x 100ms chunk gaps: a streamed answer shows text well before the end.
    expect(m.ttftMs!).toBeLessThan(m.totalMs - 250);
  });

  it("tool round: refer_doctors slot lookups run concurrently and keep doctor order", async () => {
    const sessionId = await newSession();
    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    const doctors = Array.from({ length: 12 }, (_, i) => ({
      doctorId: `doc-${i}`,
      slug: `doc-${i}`,
      name: `Doctor ${i}`,
      specialties: ["Cardiology", "Cardiologist"],
      consultationFee: 1000,
      availableSlots: 1,
      pmdcVerified: true,
      ratingAvg: 4.5,
      ratingCount: 10,
    }));
    jest
      .spyOn(OnlineConsultService, "listConsultDoctors")
      .mockResolvedValue(doctors as never);
    let inFlight = 0;
    let maxInFlight = 0;
    let lookups = 0;
    const slotLookupMs: number[] = [];
    jest.spyOn(OnlineConsultService, "getSlotsForDoctor").mockImplementation(async (doctorId: string) => {
      const t0 = performance.now();
      lookups += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(50);
      inFlight -= 1;
      slotLookupMs.push(performance.now() - t0);
      const index = Number(doctorId.split("-")[1]);
      const start = new Date(Date.now() + 2 * 86_400_000);
      // Only doctors 6..11 have open slots, forcing several empty lookups first.
      const slots =
        index >= 6
          ? [{ slotId: `s-${index}`, startAt: start.toISOString(), endAt: new Date(start.getTime() + 1_800_000).toISOString(), status: "available" }]
          : [];
      return { slots } as never;
    });

    const gemini = installGeminiMock([
      { latencyMs: 300, functionCall: { name: "refer_doctors", args: { specialty: "Cardiology" } } },
      { latencyMs: 300, chunks: ["Here are ", "cardiologists ", "with open slots."] },
    ]);
    const toolsStart = performance.now();
    const result = await postQuestion(sessionId, QUESTION);
    void toolsStart;
    gemini.restore();

    const metadataEvent = result.events.find((e) => e.event === "metadata");
    const referrals = (metadataEvent?.data.metadata as { doctorReferrals?: Array<{ doctorId: string }> })
      ?.doctorReferrals;
    const m = summarize("tool-round", result, {
      geminiCalls: gemini.calls.length,
      slotLookups: lookups,
      maxConcurrentSlotLookups: maxInFlight,
      slotLookupTotalMsApprox: Math.round(slotLookupMs.reduce((a, b) => a + b, 0)),
      referralOrder: referrals?.map((r) => r.doctorId).join(","),
    });

    expect(m.terminal).toBe("done");
    expect(referrals?.map((r) => r.doctorId)).toEqual(["doc-6", "doc-7", "doc-8", "doc-9", "doc-10"]);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(m.statusEvents).toBeGreaterThan(0);
  });

  it("history: newest messages are sent to Gemini and the current question appears exactly once", async () => {
    const sessionId = await newSession();
    const base = Date.now() - 3_600_000;
    await db.CopilotMessageModel.create(
      Array.from({ length: 60 }, (_, i) => ({
        sessionId,
        role: i % 2 === 0 ? db.CopilotMessageRoles.USER : db.CopilotMessageRoles.ASSISTANT,
        content: `history-${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    );
    const gemini = installGeminiMock([{ chunks: ["ok"] }]);
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();

    const body = gemini.calls[0].body as { contents: Array<{ parts: Array<{ text?: string }> }> };
    const texts = body.contents.flatMap((c) => c.parts.map((p) => p.text ?? ""));
    summarize("history", result, {
      historyFirst: texts[0],
      historyLast: texts[texts.length - 2],
      questionCount: texts.filter((t) => t === QUESTION).length,
    });

    expect(texts.filter((t) => t === QUESTION)).toHaveLength(1);
    expect(texts).toContain("history-59");
    expect(texts).not.toContain("history-0");
  });

  it("tool rounds: all 8 rounds stay available, then one final answer is requested without tools", async () => {
    const sessionId = await newSession();
    const toolTurn: Turn = { functionCall: { name: "get_service_links", args: {} } };
    const gemini = installGeminiMock([
      { chunks: ["Let me check. "], functionCall: { name: "get_service_links", args: {} } },
      ...Array.from({ length: 7 }, () => toolTurn),
      { chunks: ["Here are the links."] },
    ]);
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();
    const m = summarize("eight-rounds", result, { geminiCalls: gemini.calls.length });

    expect(m.terminal).toBe("done");
    expect(gemini.calls).toHaveLength(9);
    expect((gemini.calls[7].body as { tools?: unknown }).tools).toBeDefined();
    expect((gemini.calls[8].body as { tools?: unknown }).tools).toBeUndefined();
    // Preamble streamed during a tool round is followed by a reset status event.
    const preambleAt = result.events.findIndex((e) => e.event === "token");
    expect(result.events[preambleAt + 1]).toMatchObject({ event: "status", data: { reset: true } });
    const done = result.events.find((e) => e.event === "done");
    expect((done?.data.message as { content: string }).content).toBe("Here are the links.");
  });

  it("provider HTTP 500: stream ends with an error event and no assistant message is stored", async () => {
    const sessionId = await newSession();
    const gemini = installGeminiMock([{ httpStatus: 500 }]);
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();
    const m = summarize("provider-500", result, { geminiCalls: gemini.calls.length });

    expect(m.status).toBe(200);
    expect(m.terminal).toBe("error");
    const assistant = await db.CopilotMessageModel.countDocuments({
      sessionId,
      role: db.CopilotMessageRoles.ASSISTANT,
    });
    expect(assistant).toBe(0);
  });

  it("empty answer truncated by MAX_TOKENS: returns an error event instead of a blank reply", async () => {
    const sessionId = await newSession();
    const gemini = installGeminiMock([
      { chunks: [], finishReason: "MAX_TOKENS" },
      { chunks: [], finishReason: "MAX_TOKENS" },
    ]);
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();
    const m = summarize("empty-max-tokens", result, { geminiCalls: gemini.calls.length });

    expect(m.terminal).toBe("error");
  });

  it("hung provider: request is aborted by a bounded timeout and the stream ends with an error", async () => {
    const sessionId = await newSession();
    const gemini = installGeminiMock([{ hang: true }]);
    const result = await postQuestion(sessionId, QUESTION);
    gemini.restore();
    const m = summarize("hung-provider", result, {
      geminiCalls: gemini.calls.length,
      fetchHadSignal: Boolean(gemini.calls[0]?.signal),
    });

    expect(m.terminal).toBe("error");
    expect(m.totalMs).toBeLessThan(30_000);
  }, 45_000);

  it("client disconnect: the in-flight Gemini request is cancelled", async () => {
    const sessionId = await newSession();
    const gemini = installGeminiMock([{ latencyMs: 5_000, chunks: ["late"] }]);
    const result = await postQuestion(sessionId, QUESTION, { abortAfterMs: 200 });
    await sleep(100);
    const signal = gemini.calls[0]?.signal;
    gemini.restore();
    summarize("client-abort", result, {
      geminiCalls: gemini.calls.length,
      geminiAborted: Boolean(signal?.aborted),
    });

    expect(signal?.aborted).toBe(true);
  });
});
