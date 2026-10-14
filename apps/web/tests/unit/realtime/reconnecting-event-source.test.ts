/**
 * Client SSE lifecycle shared by medical Q&A, Sunday consult and urgent
 * consult (via useEventSourceListener). Uses a fake EventSource and a fake
 * document visibility target, so no DOM is needed.
 */
import {
  connectReconnectingEventSource,
  type EventSourceLike,
} from "@/lib/realtime/reconnecting-event-source";

class FakeSource implements EventSourceLike {
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;
  constructor(public url: string) {}
  close() {
    this.closed = true;
  }
  send(payload: unknown) {
    this.onmessage?.({ data: typeof payload === "string" ? payload : JSON.stringify(payload) });
  }
  fail() {
    this.onerror?.({});
  }
}

function fakeVisibility() {
  const listeners = new Set<() => void>();
  const target = {
    visibilityState: "visible",
    addEventListener: (_: "visibilitychange", l: () => void) => listeners.add(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => listeners.delete(l),
  };
  return {
    target,
    listeners,
    set(state: "visible" | "hidden") {
      target.visibilityState = state;
      for (const l of [...listeners]) l();
    },
  };
}

function setup() {
  const sources: FakeSource[] = [];
  const visibility = fakeVisibility();
  const events: unknown[] = [];
  const resyncs: string[] = [];
  const stop = connectReconnectingEventSource({
    url: "/api/v1/medical-questions/q/events",
    onEvent: (m) => events.push(m),
    onResync: (reason) => resyncs.push(reason),
    createEventSource: (url) => {
      const s = new FakeSource(url);
      sources.push(s);
      return s;
    },
    visibility: visibility.target,
  });
  const latest = () => sources[sources.length - 1]!;
  return { sources, latest, visibility, events, resyncs, stop };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("reconnecting event source", () => {
  test("resyncs on connect, forwards real events, ignores malformed ones", () => {
    const t = setup();
    t.latest().send({ type: "connected" });
    t.latest().send({ type: "answer_created", questionId: "q", answerId: "a" });
    t.latest().send("not json");
    t.latest().send({ noType: true });
    expect(t.resyncs).toEqual(["connected"]);
    expect(t.events).toEqual([{ type: "answer_created", questionId: "q", answerId: "a" }]);
    t.stop();
  });

  test("reconnects after errors with exponential backoff (1s, 2s, 4s … capped at 30s)", () => {
    const t = setup();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = t.sources.length;
      t.latest().fail();
      expect(t.sources[before - 1]!.closed).toBe(true);
      let waited = 0;
      while (t.sources.length === before) {
        jest.advanceTimersByTime(500);
        waited += 500;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    t.stop();
  });

  test("a successful reconnect resets backoff and resyncs to recover missed events", () => {
    const t = setup();
    t.latest().send({ type: "connected" });
    t.latest().fail();
    jest.advanceTimersByTime(1000);
    t.latest().fail();
    jest.advanceTimersByTime(2000);
    t.latest().send({ type: "connected" });
    expect(t.resyncs).toEqual(["connected", "connected"]);
    t.latest().fail();
    const count = t.sources.length;
    jest.advanceTimersByTime(1000);
    expect(t.sources.length).toBe(count + 1);
    t.stop();
  });

  test("tab becoming visible again resyncs; staying visible does not", () => {
    const t = setup();
    t.latest().send({ type: "connected" });
    t.visibility.set("visible");
    expect(t.resyncs).toEqual(["connected"]);
    t.visibility.set("hidden");
    t.visibility.set("visible");
    expect(t.resyncs).toEqual(["connected", "visible"]);
    t.stop();
  });

  test("tab becoming visible during a backoff reconnects immediately", () => {
    const t = setup();
    t.latest().fail();
    t.visibility.set("hidden");
    const count = t.sources.length;
    t.visibility.set("visible");
    expect(t.sources.length).toBe(count + 1);
    t.latest().send({ type: "connected" });
    // Refreshes immediately (in case the reconnect fails) and again on connect.
    expect(t.resyncs).toEqual(["visible", "connected"]);
    // The pending backoff timer was cancelled: no extra connection.
    jest.advanceTimersByTime(60_000);
    expect(t.sources.length).toBe(count + 1);
    t.stop();
  });

  test("cleanup closes the source, cancels reconnects and removes the visibility listener", () => {
    const t = setup();
    t.latest().fail();
    t.stop();
    jest.advanceTimersByTime(60_000);
    expect(t.sources).toHaveLength(1);
    expect(t.visibility.listeners.size).toBe(0);

    const t2 = setup();
    t2.stop();
    expect(t2.latest().closed).toBe(true);
    t2.latest().send({ type: "connected" });
    expect(t2.resyncs).toEqual([]);
  });

  test("messages from a replaced connection are ignored", () => {
    const t = setup();
    const old = t.latest();
    old.fail();
    jest.advanceTimersByTime(1000);
    old.send({ type: "question_updated" });
    expect(t.events).toEqual([]);
    t.stop();
  });
});
