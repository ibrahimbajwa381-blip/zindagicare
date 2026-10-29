/**
 * @jest-environment jsdom
 *
 * Client side of ring-to-join: the full-screen incoming call (shows on a
 * realtime or service-worker signal, rings, Join/Decline, closes when the
 * ring ends) and the caller's re-ring loop.
 */
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDictionary } from "@/i18n";
import { LocaleProvider } from "@/i18n/locale-provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const routerPush = jest.fn();
let pathname = "/dashboard";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => pathname,
}));
jest.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));
jest.mock("@/features/chat/components/chat-avatar", () => ({
  ChatAvatar: () => null,
}));

const stopRingtone = jest.fn();
const startRingtone = jest.fn(() => stopRingtone);
jest.mock("@/features/consult/ringtone", () => ({
  startRingtone: () => startRingtone(),
}));

let realtimeOnEvent: (() => void) | null = null;
let realtimeUrl: string | null = null;
jest.mock("@/lib/realtime/use-event-source", () => ({
  useEventSourceListener: (url: string | null, onEvent: () => void) => {
    realtimeUrl = url;
    realtimeOnEvent = onEvent;
  },
}));

type FetchCall = { url: string; body?: unknown };
let fetchCalls: FetchCall[] = [];
let incoming: unknown = null;
let ringResponses: { ringId: string; status: string }[] = [];

function installFetch() {
  fetchCalls = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    fetchCalls.push({ url, body });
    let data: unknown = { ok: true };
    if (url === "/api/v1/video/ring/incoming") data = incoming;
    else if (body?.action === "ring") data = ringResponses.shift() ?? { ringId: "r1", status: "ringing" };
    return { ok: true, json: async () => ({ success: true, data }) } as Response;
  }) as typeof fetch;
}

const swListeners: ((event: MessageEvent) => void)[] = [];
Object.defineProperty(navigator, "serviceWorker", {
  configurable: true,
  value: {
    addEventListener: (_: string, fn: (event: MessageEvent) => void) => swListeners.push(fn),
    removeEventListener: (_: string, fn: (event: MessageEvent) => void) => {
      const i = swListeners.indexOf(fn);
      if (i >= 0) swListeners.splice(i, 1);
    },
  },
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

const RING = {
  ringId: "11111111-1111-4111-8111-111111111111",
  appointmentId: "6a0000000000000000000001",
  fromName: "Dr. Ayesha Khan",
  fromRole: "doctor",
  fromAvatarUrl: null,
  startedAt: new Date().toISOString(),
};

describe("IncomingCallListener", () => {
  let container: HTMLDivElement;
  let root: Root;

  async function mount() {
    const { IncomingCallListener } = await import(
      "@/features/consult/components/incoming-call-listener"
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          LocaleProvider,
          {
            initialLocale: "en",
            initialDictionary: getDictionary("en"),
            children: createElement(IncomingCallListener),
          },
        ),
      );
    });
  }

  const button = (label: string) =>
    container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

  beforeEach(() => {
    jest.useRealTimers();
    installFetch();
    incoming = null;
    pathname = "/dashboard";
    routerPush.mockClear();
    startRingtone.mockClear();
    stopRingtone.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("subscribes to ring events and stays hidden with no ring", async () => {
    await mount();
    expect(realtimeUrl).toBe("/api/v1/video/ring/events");
    await act(async () => realtimeOnEvent!());
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(startRingtone).not.toHaveBeenCalled();
  });

  test("realtime event → full-screen ringing call; Join opens the call page", async () => {
    await mount();
    incoming = RING;
    await act(async () => realtimeOnEvent!());
    await flush();

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Incoming video call");
    expect(dialog?.textContent).toContain("Dr. Ayesha Khan");
    expect(startRingtone).toHaveBeenCalledTimes(1);

    await act(async () => button("Join")!.click());
    expect(routerPush).toHaveBeenCalledWith(`/consult/video/${RING.appointmentId}`);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(stopRingtone).toHaveBeenCalled();
  });

  test("service-worker push message also brings up the call; Decline tells the server", async () => {
    await mount();
    incoming = RING;
    await act(async () => {
      for (const fn of swListeners) fn({ data: { type: "zindagi:incoming-call" } } as MessageEvent);
    });
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await act(async () => button("Decline")!.click());
    await flush();
    expect(fetchCalls).toContainEqual({
      url: `/api/v1/video/sessions/${RING.appointmentId}/ring`,
      body: { action: "decline", ringId: RING.ringId },
    });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(stopRingtone).toHaveBeenCalled();

    // The same ring arriving again (another re-ring push) stays dismissed.
    await act(async () => realtimeOnEvent!());
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test("stops ringing on its own when the caller hangs up", async () => {
    jest.useFakeTimers();
    await mount();
    incoming = RING;
    await act(async () => realtimeOnEvent!());
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    incoming = null; // cancelled / timed out on the server
    await act(async () => {
      jest.advanceTimersByTime(4_100);
    });
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(stopRingtone).toHaveBeenCalled();
  });

  test("no ringing screen when already on that consult's call page", async () => {
    pathname = `/consult/video/${RING.appointmentId}`;
    await mount();
    incoming = RING;
    await act(async () => realtimeOnEvent!());
    await flush();
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(startRingtone).not.toHaveBeenCalled();
  });
});

describe("useOutgoingCallRing", () => {
  type Hook = ReturnType<typeof import("@/features/consult/hooks/use-outgoing-call-ring").useOutgoingCallRing>;
  let hook: Hook;
  let container: HTMLDivElement;
  let root: Root;
  const APPT = "6a0000000000000000000002";

  async function mount() {
    const { useOutgoingCallRing } = await import("@/features/consult/hooks/use-outgoing-call-ring");
    function Probe() {
      hook = useOutgoingCallRing(APPT);
      return null;
    }
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () => root.render(createElement(Probe)));
  }

  const ringBodies = () =>
    fetchCalls.filter((c) => c.url === `/api/v1/video/sessions/${APPT}/ring`).map((c) => c.body);

  beforeEach(() => {
    jest.useFakeTimers();
    installFetch();
    ringResponses = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("rings, re-rings every 7s with the same ringId, and stops when declined", async () => {
    await mount();
    ringResponses = [
      { ringId: "r1", status: "ringing" },
      { ringId: "r1", status: "ringing" },
      { ringId: "r1", status: "declined" },
    ];
    await act(async () => void hook.start());
    await flush();
    expect(hook.state).toBe("ringing");

    await act(async () => void jest.advanceTimersByTime(7_000));
    await flush();
    await act(async () => void jest.advanceTimersByTime(7_000));
    await flush();

    expect(ringBodies()).toEqual([
      { action: "ring" },
      { action: "ring", ringId: "r1" },
      { action: "ring", ringId: "r1" },
    ]);
    expect(hook.state).toBe("declined");

    // No more rings after it settled; the message fades back to idle.
    await act(async () => void jest.advanceTimersByTime(7_000));
    await flush();
    expect(ringBodies()).toHaveLength(3);
    expect(hook.state).toBe("idle");
    await act(async () => root.unmount());
  });

  test("gives up as 'missed' after ~45s without an answer", async () => {
    await mount();
    await act(async () => void hook.start());
    await flush();

    for (let i = 0; i < 7; i += 1) {
      await act(async () => void jest.advanceTimersByTime(7_000));
      await flush();
    }
    expect(hook.state).toBe("missed");
    const count = ringBodies().length;
    expect(count).toBeLessThanOrEqual(8);

    await act(async () => void jest.advanceTimersByTime(14_000));
    await flush();
    expect(ringBodies()).toHaveLength(count);
    await act(async () => root.unmount());
  });

  test("cancel and leaving the page both hang up on the other side", async () => {
    await mount();
    await act(async () => void hook.start());
    await flush();
    await act(async () => hook.cancel());
    expect(hook.state).toBe("idle");
    expect(ringBodies().at(-1)).toEqual({ action: "cancel", ringId: "r1" });

    await act(async () => void hook.start());
    await flush();
    await act(async () => root.unmount());
    expect(ringBodies().at(-1)).toEqual({ action: "cancel", ringId: "r1" });
  });

  test("server refusal shows the error and does not keep ringing", async () => {
    await mount();
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: { message: "Join the video call first, then ring." } }),
    })) as unknown as typeof fetch;

    await act(async () => void hook.start());
    await flush();
    expect(hook.state).toBe("idle");
    expect(hook.error).toBe("Join the video call first, then ring.");
    await act(async () => root.unmount());
  });
});
