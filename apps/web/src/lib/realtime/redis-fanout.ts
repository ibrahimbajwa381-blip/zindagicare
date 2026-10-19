import type { EventEmitter } from "events";

/**
 * Cross-instance fan-out for SSE notifications.
 *
 * Each server instance keeps its local EventEmitter (one room per SSE topic)
 * for same-instance delivery. When Redis is configured, publishes go to a
 * Redis channel instead, and every instance that has viewers for a room holds
 * ONE shared Redis subscription for it, handing incoming messages to the
 * viewers attached to that subscription. Without Redis (or when a publish
 * fails) delivery falls back to the local emitter only.
 *
 * Messages are notifications, never content: subscribers re-fetch through the
 * authorized API, so a dropped, duplicated or reordered message only changes
 * when a refresh happens, never what a viewer is allowed to see.
 */

/** A live Redis subscription to one channel. */
export type FanoutSubscription = {
  on(type: "message", listener: (data: { channel: string; message: unknown }) => void): void;
  on(type: "subscribe", listener: (count: number) => void): void;
  /** Fires at most once, when the subscription stops delivering for any reason other than unsubscribe(). */
  on(type: "error", listener: (error: Error) => void): void;
  unsubscribe(): Promise<void>;
};

export type FanoutRedis = {
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(channel: string): FanoutSubscription;
};

export type FanoutConfig<E> = {
  /** Log prefix, e.g. "medical-qa". */
  name: string;
  emitter: EventEmitter;
  getRedis: () => FanoutRedis | null;
  /** Redis channel for a local room key. */
  channelFor: (room: string) => string;
  /** Validates/sanitizes an incoming Redis message; null drops it. */
  parse: (raw: unknown) => E | null;
  /** Local room an event belongs to. */
  roomOf: (event: E) => string;
  publishTimeoutMs?: number;
  /** How long a new viewer waits for Redis to confirm the subscription. */
  readyTimeoutMs?: number;
  /**
   * A shared subscription is not reused by NEW viewers after this age, which
   * bounds how long any one Redis stream stays open.
   */
  maxSubscriptionAgeMs?: number;
  now?: () => number;
};

export type FanoutListener<E> = {
  onEvent: (event: E) => void;
  /** The shared Redis subscription broke; the viewer should reconnect and resync. */
  onReset: () => void;
};

type Entry<E> = {
  subscription: FanoutSubscription;
  viewers: Set<FanoutListener<E>>;
  createdAt: number;
  ready: Promise<void>;
  confirmed: boolean;
  closed: boolean;
};

export function createRedisFanout<E>(config: FanoutConfig<E>) {
  const {
    name,
    emitter,
    getRedis,
    channelFor,
    parse,
    roomOf,
    publishTimeoutMs = 2000,
    readyTimeoutMs = 3000,
    maxSubscriptionAgeMs = 4 * 60_000,
    now = Date.now,
  } = config;

  const current = new Map<string, Entry<E>>();
  let lastLogAt = Number.NEGATIVE_INFINITY;

  function log(message: string, err?: unknown) {
    // Throttled; never logs message payloads.
    const t = now();
    if (t - lastLogAt < 60_000) return;
    lastLogAt = t;
    console.error(`[realtime:${name}] ${message}`, err instanceof Error ? err.message : (err ?? ""));
  }

  /** One viewer's failure must never block other viewers, a publish, or the Redis stream. */
  function deliver(viewer: FanoutListener<E>, event: E) {
    try {
      viewer.onEvent(event);
    } catch (err) {
      log("viewer callback failed", err);
    }
  }

  function reset(viewer: FanoutListener<E>) {
    try {
      viewer.onReset();
    } catch (err) {
      log("viewer reset failed", err);
    }
  }

  function closeEntry(room: string, entry: Entry<E>) {
    if (entry.closed) return;
    entry.closed = true;
    if (current.get(room) === entry) current.delete(room);
    entry.subscription.unsubscribe().catch(() => {});
  }

  function openEntry(redis: FanoutRedis, room: string): Entry<E> {
    const channel = channelFor(room);
    const subscription = redis.subscribe(channel);
    let markReady: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    const entry: Entry<E> = {
      subscription,
      viewers: new Set(),
      createdAt: now(),
      ready,
      confirmed: false,
      closed: false,
    };

    subscription.on("subscribe", () => {
      entry.confirmed = true;
      markReady();
    });
    subscription.on("message", ({ channel: from, message }) => {
      if (entry.closed || from !== channel) return;
      let event: E | null = null;
      try {
        event = parse(typeof message === "string" ? JSON.parse(message) : message);
      } catch {
        event = null;
      }
      if (!event || roomOf(event) !== room) return;
      // Only this subscription's viewers: during a rotation two subscriptions
      // for the room overlap, and each message must reach a viewer once.
      for (const viewer of [...entry.viewers]) deliver(viewer, event);
    });
    subscription.on("error", (err) => {
      markReady();
      if (entry.closed) return;
      log("redis subscription stopped", err);
      const wasConfirmed = entry.confirmed;
      closeEntry(room, entry);
      // A subscription that worked and then broke: viewers reconnect and get a
      // fresh one. One that never came up means Redis is unreachable; viewers
      // stay on local delivery until their stream rotates, instead of
      // reconnect-looping against a dead Redis.
      if (wasConfirmed) for (const viewer of [...entry.viewers]) reset(viewer);
    });
    return entry;
  }

  function acquire(redis: FanoutRedis, room: string): Entry<E> {
    const existing = current.get(room);
    if (existing && !existing.closed && now() - existing.createdAt < maxSubscriptionAgeMs) return existing;
    // Old entry (if any) stays alive for its remaining viewers and closes when they leave.
    const entry = openEntry(redis, room);
    current.set(room, entry);
    return entry;
  }

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve("timeout"), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  return {
    /**
     * Delivers an event to every instance's viewers of its room. Never throws.
     * Returns where it went: "redis" (all instances) or "local" (this one only).
     */
    async publish(event: E): Promise<"redis" | "local"> {
      const room = roomOf(event);
      let redis: FanoutRedis | null = null;
      try {
        redis = getRedis();
      } catch (err) {
        log("redis client unavailable", err);
      }
      if (redis) {
        try {
          const result = await withTimeout(redis.publish(channelFor(room), JSON.stringify(event)), publishTimeoutMs);
          if (result !== "timeout") return "redis"; // our own subscription delivers locally
          log("redis publish timed out; delivering on this instance only");
        } catch (err) {
          log("redis publish failed; delivering on this instance only", err);
        }
      }
      emitter.emit(room, event);
      return "local";
    },

    /**
     * Attaches a viewer to a room. Resolves once the Redis subscription is
     * confirmed (or after `readyTimeoutMs`), so a viewer that resyncs right
     * after this can't miss an event published in between. Returns a release
     * function; calling it more than once is harmless.
     */
    async subscribe(room: string, listener: FanoutListener<E>): Promise<() => void> {
      // Local emitter: same-instance fallback deliveries (no Redis / failed publish).
      const onLocal = (event: E) => deliver(listener, event);
      emitter.on(room, onLocal);

      let entry: Entry<E> | null = null;
      try {
        const redis = getRedis();
        if (redis) {
          entry = acquire(redis, room);
          entry.viewers.add(listener);
        }
      } catch (err) {
        log("redis subscribe failed; this instance only", err);
      }

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        emitter.off(room, onLocal);
        if (entry) {
          entry.viewers.delete(listener);
          if (entry.viewers.size === 0) closeEntry(room, entry);
        }
      };

      if (entry) {
        const result = await withTimeout(entry.ready, readyTimeoutMs);
        if (result === "timeout") log("redis subscription not confirmed in time");
      }
      return release;
    },

    /** Test/diagnostic helper: number of live shared subscriptions. */
    activeSubscriptionCount() {
      return [...current.values()].filter((e) => !e.closed).length;
    },
  };
}
