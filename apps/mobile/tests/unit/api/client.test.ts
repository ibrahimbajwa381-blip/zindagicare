import { apiFetch, ApiRequestError } from "@/api/client";
import { setStoredTokens, clearStoredTokens, getStoredTokens } from "@/lib/token-storage";

function jsonResponse(body: unknown, status = 200) {
  return { status, json: () => Promise.resolve(body) } as Response;
}

describe("apiFetch", () => {
  beforeEach(async () => {
    await clearStoredTokens();
    globalThis.fetch = jest.fn();
  });

  it("returns data on a successful envelope", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: true, data: { id: "1" }, error: null }));

    const result = await apiFetch<{ id: string }>("/api/v1/thing");
    expect(result).toEqual({ id: "1" });
  });

  it("throws ApiRequestError with the envelope's message/code/status on a 400", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ success: false, data: null, error: { code: "BAD_INPUT", message: "Invalid phone number" } }, 400),
    );

    await expect(apiFetch("/api/v1/thing")).rejects.toMatchObject({
      message: "Invalid phone number",
      code: "BAD_INPUT",
      status: 400,
    });
  });

  it("still throws (not crashes with an unrelated error) on a 400 with a missing error payload", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false, data: null }, 400));

    await expect(apiFetch("/api/v1/thing")).rejects.toBeTruthy();
  });

  it("propagates a network failure as-is (not silently swallowed)", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));

    await expect(apiFetch("/api/v1/thing")).rejects.toThrow("Network request failed");
  });

  it("silently refreshes the access token on a 401 and retries the request exactly once", async () => {
    await setStoredTokens("expired-access", "valid-refresh");
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: { code: "AUTH", message: "Expired" } }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { accessToken: "new-access", refreshToken: "new-refresh", user: { id: "u1", roles: ["patient"] } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: "1" }, error: null }));

    const result = await apiFetch<{ id: string }>("/api/v1/thing");

    expect(result).toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // original 401 + refresh call + retried original
    expect(await getStoredTokens()).toEqual({ accessToken: "new-access", refreshToken: "new-refresh" });
  });

  it("clears stored tokens and surfaces the original 401 error when the refresh token is also invalid", async () => {
    await setStoredTokens("expired-access", "expired-refresh");
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: { code: "AUTH", message: "Session expired" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: { code: "AUTH", message: "Invalid refresh token" } }, 401));

    await expect(apiFetch("/api/v1/thing")).rejects.toMatchObject({ message: "Session expired", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2); // original 401 + one failed refresh attempt, no retry loop
    expect(await getStoredTokens()).toEqual({ accessToken: null, refreshToken: null });
  });

  it("deduplicates concurrent 401s into a single token refresh call", async () => {
    await setStoredTokens("expired-access", "valid-refresh");
    const fetchMock = globalThis.fetch as jest.Mock;
    let refreshCalls = 0;
    // Any call still using the stale token gets a 401; the refresh endpoint always succeeds;
    // a call carrying the freshly-refreshed token succeeds.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { accessToken: "new-access", refreshToken: "new-refresh", user: { id: "u1", roles: ["patient"] } },
          }),
        );
      }
      const usesNewToken = (init?.headers as Record<string, string> | undefined)?.Authorization === "Bearer new-access";
      if (usesNewToken) {
        return Promise.resolve(jsonResponse({ success: true, data: { ok: true }, error: null }));
      }
      return Promise.resolve(jsonResponse({ success: false, data: null, error: { code: "AUTH", message: "Expired" } }, 401));
    });

    const [a, b] = await Promise.all([apiFetch("/api/v1/one"), apiFetch("/api/v1/two")]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });
});
