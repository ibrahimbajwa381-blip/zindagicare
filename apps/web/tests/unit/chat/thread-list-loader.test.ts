import { createThreadListLoader } from "@/features/chat/lib/thread-list-loader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createThreadListLoader", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("overlapping calls (timer + realtime) share one request", async () => {
    const pending = deferred<string[]>();
    const fetchRows = jest.fn(() => pending.promise);
    const onRows = jest.fn();
    const { load } = createThreadListLoader(fetchRows, onRows, () => {});

    const calls = [load(), load(), load()];
    expect(fetchRows).toHaveBeenCalledTimes(1);

    pending.resolve(["a"]);
    await Promise.all(calls);
    expect(onRows).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenCalledWith(["a"]);
  });

  test("starts a fresh request once the previous one settles", async () => {
    const fetchRows = jest
      .fn<Promise<string[]>, []>()
      .mockResolvedValueOnce(["a"])
      .mockResolvedValueOnce(["a", "b"]);
    const onRows = jest.fn();
    const { load } = createThreadListLoader(fetchRows, onRows, () => {});

    await load();
    await load();
    expect(fetchRows).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenLastCalledWith(["a", "b"]);
  });

  test("a failed refresh keeps existing rows, ends loading and logs without details", async () => {
    const fetchRows = jest
      .fn<Promise<string[]>, []>()
      .mockResolvedValueOnce(["a"])
      .mockRejectedValueOnce(new TypeError("patient secret text"));
    const onRows = jest.fn();
    const onSettled = jest.fn();
    const { load } = createThreadListLoader(fetchRows, onRows, onSettled);

    await load();
    await expect(load()).resolves.toBeUndefined();

    expect(onRows).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenCalledWith(["a"]);
    expect(onSettled).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith("[chat] thread list refresh failed", {
      error: "TypeError",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("patient secret text");
  });

  test("recovers after a failure on the next call", async () => {
    const fetchRows = jest
      .fn<Promise<string[]>, []>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(["a"]);
    const onRows = jest.fn();
    const { load } = createThreadListLoader(fetchRows, onRows, () => {});

    await load();
    await load();
    expect(fetchRows).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenCalledWith(["a"]);
  });

  test("loadFresh after a new chat is created is not satisfied by an older in-flight poll", async () => {
    const stalePoll = deferred<string[]>();
    const fetchRows = jest
      .fn<Promise<string[]>, []>()
      .mockReturnValueOnce(stalePoll.promise)
      .mockResolvedValueOnce(["old", "new"]);
    const onRows = jest.fn();
    const { load, loadFresh } = createThreadListLoader(fetchRows, onRows, () => {});

    const poll = load(); // background refresh started before the chat existed
    const opened = loadFresh(); // new chat created while that poll is pending
    expect(fetchRows).toHaveBeenCalledTimes(1);

    stalePoll.resolve(["old"]);
    await Promise.all([poll, opened]);

    expect(fetchRows).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenLastCalledWith(["old", "new"]);
  });

  test("loadFresh with nothing in flight makes exactly one request and still dedupes", async () => {
    const pending = deferred<string[]>();
    const fetchRows = jest.fn(() => pending.promise);
    const { load, loadFresh } = createThreadListLoader(fetchRows, () => {}, () => {});

    const fresh = loadFresh();
    const poll = load();
    expect(fetchRows).toHaveBeenCalledTimes(1);

    pending.resolve(["a"]);
    await Promise.all([fresh, poll]);
    expect(fetchRows).toHaveBeenCalledTimes(1);
  });

  test("loadFresh still reloads when the in-flight poll fails", async () => {
    const fetchRows = jest
      .fn<Promise<string[]>, []>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(["new"]);
    const onRows = jest.fn();
    const { load, loadFresh } = createThreadListLoader(fetchRows, onRows, () => {});

    void load();
    await loadFresh();
    expect(fetchRows).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenCalledWith(["new"]);
  });
});
