import { createOwnEchoFilter, createRefreshCoordinator } from "@/features/medical-qa/lib/live-refresh";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const calls: { d: Deferred<number>; signal: AbortSignal }[] = [];
  const applied: number[] = [];
  const errors: unknown[] = [];
  const coordinator = createRefreshCoordinator<number>({
    load: (signal) => {
      const d = deferred<number>();
      calls.push({ d, signal });
      return d.promise;
    },
    apply: (v) => applied.push(v),
    onError: (e) => errors.push(e),
  });
  return { calls, applied, errors, coordinator };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("Q&A refresh coordinator", () => {
  test("a burst of events within 400ms becomes one request", async () => {
    const t = setup();
    t.coordinator.schedule();
    jest.advanceTimersByTime(200);
    t.coordinator.schedule();
    t.coordinator.schedule();
    jest.advanceTimersByTime(399);
    expect(t.calls).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(t.calls).toHaveLength(1);
    t.calls[0]!.d.resolve(1);
    await flush();
    expect(t.applied).toEqual([1]);
  });

  test("never overlaps requests; events during a request queue exactly one follow-up", async () => {
    const t = setup();
    t.coordinator.schedule();
    jest.advanceTimersByTime(400);
    expect(t.calls).toHaveLength(1);

    for (let i = 0; i < 3; i++) {
      t.coordinator.schedule();
      jest.advanceTimersByTime(400);
    }
    expect(t.calls).toHaveLength(1); // still in flight: no overlap

    t.calls[0]!.d.resolve(1);
    await flush();
    expect(t.calls).toHaveLength(2);
    t.calls[1]!.d.resolve(2);
    await flush();
    expect(t.applied).toEqual([1, 2]);
    expect(t.calls).toHaveLength(2);
  });

  test("now() skips the debounce, cancels a pending one, and waits for a load started after it", async () => {
    const t = setup();
    t.coordinator.schedule();
    const done = t.coordinator.now();
    expect(t.calls).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    expect(t.calls).toHaveLength(1); // the scheduled one was absorbed

    let resolved = false;
    void done.then(() => (resolved = true));
    t.calls[0]!.d.resolve(5);
    await flush();
    expect(resolved).toBe(true);
    expect(t.applied).toEqual([5]);
  });

  test("now() during an in-flight request resolves only after the follow-up reflects the write", async () => {
    const t = setup();
    t.coordinator.schedule();
    jest.advanceTimersByTime(400);
    let resolved = false;
    void t.coordinator.now().then(() => (resolved = true));
    t.calls[0]!.d.resolve(1); // started before the write
    await flush();
    expect(resolved).toBe(false);
    t.calls[1]!.d.resolve(2);
    await flush();
    expect(resolved).toBe(true);
    expect(t.applied).toEqual([1, 2]);
  });

  test("a response arriving after dispose (e.g. unmount) is never applied, and the request is aborted", async () => {
    const t = setup();
    void t.coordinator.now();
    t.coordinator.dispose();
    expect(t.calls[0]!.signal.aborted).toBe(true);
    t.calls[0]!.d.resolve(9);
    await flush();
    expect(t.applied).toEqual([]);
    t.coordinator.schedule();
    jest.advanceTimersByTime(1000);
    expect(t.calls).toHaveLength(1);
  });

  test("an older response can never overwrite a newer one", async () => {
    // Responses are applied strictly in request order, one request at a time.
    const t = setup();
    void t.coordinator.now();
    void t.coordinator.now();
    t.calls[0]!.d.resolve(1);
    await flush();
    t.calls[1]!.d.resolve(2);
    await flush();
    expect(t.applied).toEqual([1, 2]);
    expect(t.applied[t.applied.length - 1]).toBe(2);
  });

  test("a failed load keeps current data and the next event retries", async () => {
    const t = setup();
    void t.coordinator.now();
    t.calls[0]!.d.reject(new Error("offline"));
    await flush();
    expect(t.applied).toEqual([]);
    expect(t.errors).toHaveLength(1);
    t.coordinator.schedule();
    jest.advanceTimersByTime(400);
    expect(t.calls).toHaveLength(2);
  });
});

describe("own-answer echo filter", () => {
  test("posting an answer then receiving its SSE echo causes no second refresh", async () => {
    const t = setup();
    const echoes = createOwnEchoFilter();
    const onRealtime = (event: { type: string; answerId?: string }) => {
      if (!echoes.isOwnEcho(event)) t.coordinator.schedule();
    };

    // ReplyBox: POST succeeded → remember + immediate refresh.
    echoes.remember("a1");
    void t.coordinator.now();
    // The SSE echo of that same answer arrives.
    onRealtime({ type: "answer_created", answerId: "a1" });
    t.calls[0]!.d.resolve(1);
    await flush();
    jest.advanceTimersByTime(1000);
    expect(t.calls).toHaveLength(1);

    // Someone else's answer still refreshes.
    onRealtime({ type: "answer_created", answerId: "a2" });
    jest.advanceTimersByTime(400);
    expect(t.calls).toHaveLength(2);
  });

  test("echo arriving before the POST response is absorbed by the immediate refresh", () => {
    const t = setup();
    const echoes = createOwnEchoFilter();
    if (!echoes.isOwnEcho({ type: "answer_created", answerId: "a1" })) t.coordinator.schedule();
    echoes.remember("a1");
    void t.coordinator.now();
    jest.advanceTimersByTime(1000);
    expect(t.calls).toHaveLength(1);
  });

  test("each id is skipped once; resync and other types always pass", () => {
    const echoes = createOwnEchoFilter();
    echoes.remember("a1");
    expect(echoes.isOwnEcho({ type: "resync" })).toBe(false);
    expect(echoes.isOwnEcho({ type: "question_updated", answerId: "a1" })).toBe(false);
    expect(echoes.isOwnEcho({ type: "answer_created", answerId: "a1" })).toBe(true);
    expect(echoes.isOwnEcho({ type: "answer_created", answerId: "a1" })).toBe(false);
  });
});
