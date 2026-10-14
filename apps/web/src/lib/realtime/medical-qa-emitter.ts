import { EventEmitter } from "events";
import { objectIdSchema } from "@zindagi/validators";
import { getRealtimeRedis } from "@/server/lib/realtime-redis";
import { createRealtimeEmitter } from "./create-emitter";
import { createRedisFanout } from "./redis-fanout";

/**
 * Public Q&A events carry ids only — never question/answer text, author
 * details or attachment URLs. Subscribers (anyone viewing a public question)
 * re-fetch through the normal API, which applies authorization, so a public
 * channel can't leak private data and a missed event only delays a refresh.
 */
export type MedicalQaRealtimeEvent = {
  type: "answer_created" | "question_updated";
  questionId: string;
  answerId?: string;
};

declare global {
  var medicalQaRealtimeEmitter: EventEmitter | undefined;
}

/**
 * Per-instance delivery to this process's SSE connections. Cross-instance
 * delivery goes through `medicalQaFanout` (Redis when configured).
 */
export const medicalQaEmitter = createRealtimeEmitter({
  get: () => global.medicalQaRealtimeEmitter,
  set: (emitter) => {
    global.medicalQaRealtimeEmitter = emitter;
  },
  alwaysPersist: true,
});

export function questionRoomKey(questionId: string) {
  return `medical-qa:question:${questionId}`;
}

const EVENT_TYPES = new Set<MedicalQaRealtimeEvent["type"]>(["answer_created", "question_updated"]);
const isId = (v: unknown): v is string => objectIdSchema.safeParse(v).success;

/** Rebuilds an event from untrusted input, keeping only known id fields. */
export function sanitizeMedicalQaEvent(raw: unknown): MedicalQaRealtimeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const { type, questionId, answerId } = raw as Record<string, unknown>;
  if (!EVENT_TYPES.has(type as MedicalQaRealtimeEvent["type"]) || !isId(questionId)) return null;
  if (answerId !== undefined && !isId(answerId)) return null;
  return {
    type: type as MedicalQaRealtimeEvent["type"],
    questionId,
    ...(answerId ? { answerId } : {}),
  };
}

export const medicalQaFanout = createRedisFanout<MedicalQaRealtimeEvent>({
  name: "medical-qa",
  emitter: medicalQaEmitter,
  getRedis: getRealtimeRedis,
  channelFor: (room) => `zindagi:rt:${room}`,
  parse: sanitizeMedicalQaEvent,
  roomOf: (event) => questionRoomKey(event.questionId),
});

/**
 * Call only after the MongoDB write has succeeded. Never throws: a failed
 * Redis publish falls back to this instance's viewers, and everyone else
 * catches up on their next reconnect/tab-focus resync.
 */
export function publishMedicalQaEvent(event: MedicalQaRealtimeEvent) {
  const clean = sanitizeMedicalQaEvent(event);
  if (!clean) return Promise.resolve("local" as const);
  return medicalQaFanout.publish(clean);
}
