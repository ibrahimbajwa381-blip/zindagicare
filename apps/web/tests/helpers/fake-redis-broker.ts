/**
 * In-memory stand-in for Upstash Pub/Sub, shared by the realtime tests.
 * Several fan-outs (one per simulated Vercel instance) can share one broker.
 * It never touches the network.
 */
import { EventEmitter } from "events";
import { createRedisFanout, type FanoutConfig, type FanoutRedis, type FanoutSubscription } from "@/lib/realtime/redis-fanout";
import { questionRoomKey, sanitizeMedicalQaEvent, type MedicalQaRealtimeEvent } from "@/lib/realtime/medical-qa-emitter";

export type FakeSub = {
  channel: string;
  listeners: Record<string, ((data: never) => void)[]>;
  closed: boolean;
  emit(type: string, data: unknown): void;
};

export function createFakeBroker(options: { autoConfirm?: boolean } = {}) {
  const { autoConfirm = true } = options;
  const subs: FakeSub[] = [];
  const published: { channel: string; message: string }[] = [];
  const state = { failPublish: null as Error | null, hangPublish: false, publishDelayMs: 0 };

  const redis: FanoutRedis = {
    async publish(channel, message) {
      if (state.failPublish) throw state.failPublish;
      if (state.hangPublish) return new Promise(() => {});
      if (state.publishDelayMs) await new Promise((r) => setTimeout(r, state.publishDelayMs));
      published.push({ channel, message });
      for (const s of subs) if (!s.closed && s.channel === channel) s.emit("message", { channel, message });
      return 1;
    },
    subscribe(channel) {
      const sub: FakeSub = {
        channel,
        listeners: {},
        closed: false,
        emit(type, data) {
          for (const l of this.listeners[type] ?? []) l(data as never);
        },
      };
      subs.push(sub);
      if (autoConfirm) queueMicrotask(() => sub.emit("subscribe", 1));
      return {
        on(type: string, listener: (data: never) => void) {
          (sub.listeners[type] ??= []).push(listener);
        },
        async unsubscribe() {
          sub.closed = true;
        },
      } as FanoutSubscription;
    },
  };

  return { redis, subs, published, state, live: () => subs.filter((s) => !s.closed) };
}

export function createQaInstance(
  getRedis: () => FanoutRedis | null,
  extra: Partial<FanoutConfig<MedicalQaRealtimeEvent>> = {},
) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0); // as in production (createRealtimeEmitter): one listener per SSE connection
  const fanout = createRedisFanout<MedicalQaRealtimeEvent>({
    name: "test",
    emitter,
    getRedis,
    channelFor: (room) => `zindagi:rt:${room}`,
    parse: sanitizeMedicalQaEvent,
    roomOf: (e) => questionRoomKey(e.questionId),
    readyTimeoutMs: 50,
    publishTimeoutMs: 50,
    ...extra,
  });
  return { emitter, fanout };
}

export function recordingViewer() {
  const events: MedicalQaRealtimeEvent[] = [];
  let resets = 0;
  return {
    events,
    resets: () => resets,
    listener: {
      onEvent: (e: MedicalQaRealtimeEvent) => void events.push(e),
      onReset: () => void (resets += 1),
    },
  };
}
