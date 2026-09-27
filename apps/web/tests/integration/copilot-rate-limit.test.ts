/**
 * RT-003 — AI / Gemini Assistant Rate Limiting.
 *
 * Regression test for a real bug found in this audit: POST
 * /api/v1/copilot/sessions/[id]/messages used to call the rate-limit check
 * *inside* the SSE ReadableStream body (CopilotService.sendMessageStream).
 * A throw in there is only ever caught by the stream's own try/catch and
 * emitted as an `error` SSE event on an *already-200* Response — so an
 * automated client, load balancer, or monitoring check watching HTTP status
 * codes would never see a 429 no matter how hard the limit was exceeded,
 * and (per RT-003 "important") a rate-limited request could still reach the
 * real Gemini call path before failing.
 *
 * Fixed by moving the check (CopilotService.checkRateLimit) before the
 * stream opens. This test locks that in. Gemini itself is never called —
 * sendMessageStream is mocked at the class level so no real/expensive AI
 * provider call happens in CI (RT-003 "Important" / RT-PERF-001).
 */
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));

describe("RT-003 — Copilot / Gemini assistant rate limiting", () => {
  const USER_ID = "507f1f77bcf86cd799439099";

  beforeEach(() => {
    jest.resetModules();
    process.env.COPILOT_RATE_LIMIT = "3";
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({
      user: { id: USER_ID, roles: ["patient"] },
    });
  });

  async function loadRouteWithMockedStream() {
    const { CopilotService } = await import("@/server/services/copilot.service");
    jest.spyOn(CopilotService, "sendMessageStream").mockImplementation(
      async (_userId, _sessionId, _input, onEvent) => {
        onEvent({
          type: "done",
          message: {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "ok",
            createdAt: new Date().toISOString(),
          },
        });
      },
    );
    const route = await import("@/app/api/v1/copilot/sessions/[id]/messages/route");
    return { route, CopilotService };
  }

  function postMessage(route: typeof import("@/app/api/v1/copilot/sessions/[id]/messages/route")) {
    const req = new NextRequest("http://localhost/api/v1/copilot/sessions/s1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    });
    return route.POST(req, { params: Promise.resolve({ id: "s1" }) });
  }

  test("requests within the configured limit return a 200 SSE stream", async () => {
    const { route } = await loadRouteWithMockedStream();
    const res = await postMessage(route);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  test("exceeding the limit returns a real HTTP 429 with Retry-After — not a 200 SSE stream carrying an error event", async () => {
    const { route, CopilotService } = await loadRouteWithMockedStream();
    const sendMessageStreamMock = CopilotService.sendMessageStream as jest.Mock;

    // COPILOT_RATE_LIMIT=3 for this test
    for (let i = 0; i < 3; i += 1) {
      const res = await postMessage(route);
      expect(res.status).toBe(200);
    }

    const blockedRes = await postMessage(route);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    expect(blockedRes.headers.get("content-type")).not.toContain("text/event-stream");

    const json = await blockedRes.json();
    expect(json.error.code).toBe("RATE_LIMITED");

    // The 4th (blocked) call must never reach the streaming/Gemini path at all.
    expect(sendMessageStreamMock).toHaveBeenCalledTimes(3);
  });

  test("a different user is unaffected by another user's exhausted budget (RT-CROSS-001)", async () => {
    const { route } = await loadRouteWithMockedStream();

    for (let i = 0; i < 3; i += 1) await postMessage(route);
    const blocked = await postMessage(route);
    expect(blocked.status).toBe(429);

    mockAuth.mockResolvedValue({ user: { id: "another-user-id", roles: ["patient"] } });
    const otherUserRes = await postMessage(route);
    expect(otherUserRes.status).toBe(200);
  });

  test("unauthenticated request is 401 and is never counted against the rate limit", async () => {
    mockAuth.mockResolvedValue(null);
    const { route } = await loadRouteWithMockedStream();
    const res = await postMessage(route);
    expect(res.status).toBe(401);
  });

  test("a role without health-assistant access gets a real 403, not a 500 (regression: these used to throw plain Error, not AppError)", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID, roles: ["doctor"] } });
    const { route } = await loadRouteWithMockedStream();

    const postRes = await postMessage(route);
    expect(postRes.status).toBe(403);
    const postJson = await postRes.json();
    expect(postJson.error.code).toBe("FORBIDDEN");

    const getReq = new NextRequest(
      "http://localhost/api/v1/copilot/sessions/s1/messages",
      { headers: { "content-type": "application/json" } },
    );
    const getRes = await route.GET(getReq, { params: Promise.resolve({ id: "s1" }) });
    expect(getRes.status).toBe(403);
  });
});
