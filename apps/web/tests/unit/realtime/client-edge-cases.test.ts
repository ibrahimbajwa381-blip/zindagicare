/**
 * Edge cases and boundary values for the browser side: reconnect timing,
 * message parsing, visibility handling, refresh coordination and the
 * own-answer echo filter.
 */
import {
  connectReconnectingEventSource,
  DEFAULT_RECONNECT_BASE_MS,
  MAX_RECONNECT_DELAY_MS,
  type EventSourceLike,
} from "@/lib/realtime/reconnecting-event-source";
import { createOwnEchoFilter, createRefreshCoordinator, QA_REFRESH_DEBOUNCE_MS } from "@/features/medical-qa/lib/live-refresh";

class FakeSource implements EventSourceLike {
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
  send(data: string) {
    this.onmessage?.({ data });
  }
}

function setup(options: { baseDelayMs?: number; maxDelayMs?: number; withVisibility?: boolean } = {}) {
  const sources: FakeSource[] = [];
  const events: unknown[] = [];
  const resyncs: string[] = [];
  const vis = { visibilityState: "visible", listeners: new Set<() => void>() };
  const target = {
    get visibilityState() {
      return vis.visibilityState;
    },
    addEventListener: (_: "visibilitychange", l: () => void) => vis.listeners.add(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => vis.listeners.delete(l),
  };
  const stop = connectReconnectingEventSource({
    url: "/e",
    onEvent: (m) => events.push(m),
    onResync: (r) => resyncs.push(r),
    createEventSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
    visibility: options.withVisibility === false ? null : target,
    baseDelayMs: options.baseDelayMs,
    maxDelayMs: options.maxDelayMs,
  });
  const setVisibility = (state: string) => {
    vis.visibilityState = state;
    vis.listeners.forEach((l) => l());
  };
  return { sources, events, resyncs, stop, setVisibility, latest: () => sources[sources.length - 1]!, vis };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("boundary: reconnect delays", () => {
  test("defaults are 1s base and 30s cap", () => {
    expect(DEFAULT_RECONNECT_BASE_MS).toBe(1000);
    expect(MAX_RECONNECT_DELAY_MS).toBe(30_000);
  });

  test("first reconnect happens at exactly 1000ms, not 999ms", () => {
    const t = setup();
    t.latest().onerror?.({});
    jest.advanceTimersByTime(999);
    expect(t.sources).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(t.sources).toHaveLength(2);
    t.stop();
  });

  test("the delay stays capped after very many failures (no overflow to 0/NaN/Infinity)", () => {
    const t = setup({ baseDelayMs: 1, maxDelayMs: 50 });
    for (let i = 0; i < 1500; i++) {
      t.latest().onerror?.({});
      jest.advanceTimersByTime(50);
    }
    expect(t.sources).toHaveLength(1501);
    t.latest().onerror?.({});
    jest.advanceTimersByTime(49);
    expect(t.sources).toHaveLength(1501);
    jest.advanceTimersByTime(1);
    expect(t.sources).toHaveLength(1502);
    t.stop();
  });

  test("a second error event from the same (already closed) source schedules nothing extra", () => {
    const t = setup();
    const s = t.latest();
    s.onerror?.({});
    s.onerror?.({});
    jest.advanceTimersByTime(60_000);
    expect(t.sources).toHaveLength(2);
    t.stop();
  });

  test("a non-'connected' message does not reset the backoff", () => {
    const t = setup();
    t.latest().onerror?.({});
    jest.advanceTimersByTime(1000);
    t.latest().send('{"type":"question_updated"}');
    t.latest().onerror?.({});
    jest.advanceTimersByTime(1999);
    expect(t.sources).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(t.sources).toHaveLength(3);
    t.stop();
  });
});

describe("edge: message parsing", () => {
  test.each([
    ["null", "null"],
    ["array", "[]"],
    ["number", "7"],
    ["string", '"connected"'],
    ["numeric type", '{"type":1}'],
    ["missing type", "{}"],
    ["empty", ""],
    ["truncated", '{"type":"answer_cr'],
  ])("%s is ignored without throwing", (_label, data) => {
    const t = setup();
    expect(() => t.latest().send(data)).not.toThrow();
    expect(t.events).toEqual([]);
    expect(t.resyncs).toEqual([]);
    t.stop();
  });

  test("every 'connected' (even repeated on one connection) triggers a resync", () => {
    const t = setup();
    t.latest().send('{"type":"connected"}');
    t.latest().send('{"type":"connected"}');
    expect(t.resyncs).toEqual(["connected", "connected"]);
    t.stop();
  });

  test("works without any visibility target (e.g. non-browser)", () => {
    const t = setup({ withVisibility: false });
    t.latest().send('{"type":"connected"}');
    expect(t.resyncs).toEqual(["connected"]);
    t.stop();
  });
});

describe("edge: visibility", () => {
  test("repeated hidden/visible flips resync once per return", () => {
    const t = setup();
    for (let i = 0; i < 3; i++) {
      t.setVisibility("hidden");
      t.setVisibility("hidden");
      t.setVisibility("visible");
      t.setVisibility("visible");
    }
    expect(t.resyncs).toEqual(["visible", "visible", "visible"]);
    t.stop();
  });

  test("'prerender' and other non-hidden states don't count as returning", () => {
    const t = setup();
    t.setVisibility("prerender");
    t.setVisibility("visible");
    expect(t.resyncs).toEqual([]);
    t.stop();
  });

  test("visibility change after stop does nothing", () => {
    const t = setup();
    t.stop();
    t.setVisibility("hidden");
    t.setVisibility("visible");
    expect(t.sources).toHaveLength(1);
    expect(t.resyncs).toEqual([]);
  });

  test("stop is idempotent", () => {
    const t = setup();
    t.stop();
    expect(() => t.stop()).not.toThrow();
  });
});

describe("boundary: refresh debounce", () => {
  function coordinator() {
    let loads = 0;
    const c = createRefreshCoordinator({ load: async () => ++loads, apply: () => {} });
    return { c, loads: () => loads };
  }

  test("debounce default is 400ms", () => {
    expect(QA_REFRESH_DEBOUNCE_MS).toBe(400);
  });

  test("an event every 399ms keeps postponing; a 400ms gap fires once", async () => {
    const { c, loads } = coordinator();
    for (let i = 0; i < 10; i++) {
      c.schedule();
      await jest.advanceTimersByTimeAsync(399);
    }
    expect(loads()).toBe(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(loads()).toBe(1);
  });

  test("events exactly 400ms apart each fire", async () => {
    const { c, loads } = coordinator();
    for (let i = 0; i < 3; i++) {
      c.schedule();
      await jest.advanceTimersByTimeAsync(400);
    }
    expect(loads()).toBe(3);
  });

  test("debounceMs 0 still never overlaps requests", async () => {
    let active = 0;
    let maxActive = 0;
    const c = createRefreshCoordinator({
      debounceMs: 0,
      load: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 50));
        active--;
        return 1;
      },
      apply: () => {},
    });
    for (let i = 0; i < 20; i++) {
      c.schedule();
      void c.now();
      await jest.advanceTimersByTimeAsync(5);
    }
    await jest.advanceTimersByTimeAsync(1000);
    expect(maxActive).toBe(1);
  });
});

describe("edge: refresh coordinator lifecycle", () => {
  test("now() pending behind an in-flight request still resolves if disposed (no hang)", async () => {
    let resolveLoad!: (v: number) => void;
    const c = createRefreshCoordinator({
      load: () => new Promise<number>((r) => (resolveLoad = r)),
      apply: () => {},
    });
    void c.now();
    const second = c.now();
    c.dispose();
    resolveLoad(1);
    await expect(second).resolves.toBeUndefined();
  });

  test("now() and schedule() after dispose are no-ops", async () => {
    let loads = 0;
    const c = createRefreshCoordinator({ load: async () => ++loads, apply: () => {} });
    c.dispose();
    c.dispose();
    await c.now();
    c.schedule();
    await jest.advanceTimersByTimeAsync(1000);
    expect(loads).toBe(0);
  });

  test("an apply() that throws is reported, not thrown, and later refreshes still work", async () => {
    const errors: unknown[] = [];
    let n = 0;
    const applied: number[] = [];
    const c = createRefreshCoordinator({
      load: async () => ++n,
      apply: (v) => {
        if (v === 1) throw new Error("render bug");
        applied.push(v);
      },
      onError: (e) => errors.push(e),
    });
    await c.now();
    await c.now();
    expect(errors).toHaveLength(1);
    expect(applied).toEqual([2]);
  });

  test("a load that rejects after dispose is not reported", async () => {
    const errors: unknown[] = [];
    let rejectLoad!: (e: unknown) => void;
    const c = createRefreshCoordinator({
      load: () => new Promise<number>((_, rej) => (rejectLoad = rej)),
      apply: () => {},
      onError: (e) => errors.push(e),
    });
    void c.now();
    c.dispose();
    rejectLoad(new Error("aborted"));
    await jest.advanceTimersByTimeAsync(0);
    expect(errors).toEqual([]);
  });
});

describe("boundary: own-answer echo filter", () => {
  test("remembers the last 20 ids; the 21st evicts the oldest", () => {
    const f = createOwnEchoFilter();
    for (let i = 0; i <= 20; i++) f.remember(`a${i}`);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a0" })).toBe(false);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a1" })).toBe(true);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a20" })).toBe(true);
  });

  test("custom limit of 1", () => {
    const f = createOwnEchoFilter(1);
    f.remember("a");
    f.remember("b");
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a" })).toBe(false);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "b" })).toBe(true);
  });

  test("the same id posted twice is skipped twice (once per remembered post)", () => {
    const f = createOwnEchoFilter();
    f.remember("a");
    f.remember("a");
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a" })).toBe(true);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a" })).toBe(true);
    expect(f.isOwnEcho({ type: "answer_created", answerId: "a" })).toBe(false);
  });

  test.each([[undefined], [null], [123], [{ id: "a" }], [["a"]]])(
    "a non-string answerId (%p) is never treated as an echo",
    (answerId) => {
      const f = createOwnEchoFilter();
      f.remember("a");
      expect(f.isOwnEcho({ type: "answer_created", answerId })).toBe(false);
    },
  );
});
