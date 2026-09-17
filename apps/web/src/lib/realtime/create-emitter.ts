import { EventEmitter } from "events";

/**
 * Shared boilerplate behind each `*-emitter.ts` module: reuse a global-scoped
 * EventEmitter across Next.js dev hot-reloads (and, when `alwaysPersist` is set,
 * across production bundle chunks too — matching the original chat-emitter
 * behavior). Always allows unlimited listeners since SSE routes add one
 * listener per open connection.
 */
export function createRealtimeEmitter(config: {
  get: () => EventEmitter | undefined;
  set: (emitter: EventEmitter) => void;
  alwaysPersist?: boolean;
}): EventEmitter {
  const emitter = config.get() ?? new EventEmitter();
  emitter.setMaxListeners(0);
  if (config.alwaysPersist || process.env.NODE_ENV !== "production") {
    config.set(emitter);
  }
  return emitter;
}
