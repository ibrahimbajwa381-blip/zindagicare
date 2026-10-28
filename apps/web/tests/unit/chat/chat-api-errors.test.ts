import { ChatRequestError, sendMessage, uploadVoiceNote } from "@/features/chat/lib/chat-api";

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

const voice = new Blob(["x"], { type: "audio/mp4" });

describe("chat-api errors", () => {
  test("successful upload returns the stored attachment and names the file by type", async () => {
    let sentName: string | undefined;
    mockFetch(async (_url, init) => {
      sentName = ((init?.body as FormData).get("file") as File).name;
      return Response.json({
        success: true,
        data: { storageKey: "t/a.m4a", url: "/u", mimeType: "audio/mp4" },
      });
    });
    await expect(uploadVoiceNote("t", voice)).resolves.toMatchObject({ url: "/u" });
    expect(sentName).toBe("voice-note.m4a");
  });

  test("non-JSON 413 page becomes a clear, non-retryable error", async () => {
    mockFetch(async () => new Response("<html>Request Entity Too Large</html>", { status: 413 }));
    const error = await uploadVoiceNote("t", voice).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChatRequestError);
    expect((error as ChatRequestError).message).toBe("Server error (HTTP 413)");
    expect((error as ChatRequestError).retryable).toBe(false);
  });

  test("non-JSON 502/504 pages are retryable", async () => {
    for (const status of [502, 504]) {
      mockFetch(async () => new Response("<html>Bad Gateway</html>", { status }));
      const error = (await uploadVoiceNote("t", voice).catch((e: unknown) => e)) as ChatRequestError;
      expect(error.status).toBe(status);
      expect(error.retryable).toBe(true);
    }
  });

  test("API rejections keep their message; unsupported type and auth are not retryable", async () => {
    for (const [status, message] of [
      [415, "Storage does not accept this file type"],
      [400, "Unsupported attachment format"],
      [401, "Unauthorized"],
    ] as const) {
      mockFetch(async () =>
        Response.json({ success: false, data: null, error: { message } }, { status }),
      );
      const error = (await uploadVoiceNote("t", voice).catch((e: unknown) => e)) as ChatRequestError;
      expect(error.message).toBe(message);
      expect(error.retryable).toBe(false);
    }
  });

  test("timeout gives a clear retryable error instead of waiting forever", async () => {
    mockFetch(async () => {
      throw new DOMException("signal timed out", "TimeoutError");
    });
    const error = (await sendMessage("t", "", "en", { url: "/u", mime: "audio/mp4" }).catch(
      (e: unknown) => e,
    )) as ChatRequestError;
    expect(error.message).toMatch(/took too long/);
    expect(error.status).toBeUndefined();
    expect(error.retryable).toBe(true);
  });

  test("network failure is retryable", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const error = (await uploadVoiceNote("t", voice).catch((e: unknown) => e)) as ChatRequestError;
    expect(error.message).toMatch(/Network error/);
    expect(error.retryable).toBe(true);
  });

  test("requests carry an abort signal so they cannot hang forever", async () => {
    let signal: AbortSignal | null | undefined;
    mockFetch(async (_url, init) => {
      signal = init?.signal;
      return Response.json({ success: true, data: { id: "m" } });
    });
    await sendMessage("t", "hi");
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});
