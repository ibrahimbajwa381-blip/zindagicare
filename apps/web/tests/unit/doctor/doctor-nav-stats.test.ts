/**
 * @jest-environment jsdom
 *
 * The doctor sidebar and mobile practice nav share one /doctor/summary
 * request per refresh (mount, route change, window focus). fetch is mocked.
 */
import { createElement, useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDoctorNavStats } from "@/features/doctor/hooks/use-doctor-nav-stats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const summary = { pendingRequests: 4, sundayQueue: 1, homeVisitRequests: 2, urgentCalls: 0 };
const calls: string[] = [];
const json = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  calls.length = 0;
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === "/api/v1/doctor/summary") return json({ success: true, data: summary });
    if (url === "/api/v1/chat/threads") return json({ success: true, data: [{ unreadCount: 3 }] });
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
});

const seen: Record<string, number> = {};
const report = (name: string, value: number) => {
  seen[name] = value;
};
function Probe({ name, options }: { name: string; options?: Parameters<typeof useDoctorNavStats>[0] }) {
  const stats = useDoctorNavStats(options);
  const value = stats.pendingRequests * 10 + stats.unreadMessages;
  useEffect(() => report(name, value), [name, value]);
  return null;
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("useDoctorNavStats", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  const summaryCalls = () => calls.filter((u) => u === "/api/v1/doctor/summary").length;

  function render(pathname: string) {
    act(() => {
      root.render(
        createElement("div", null,
          createElement(Probe, { name: "sidebar", options: { enabled: true, refreshOnFocus: true, refreshKey: pathname } }),
          createElement(Probe, { name: "mobile" }),
        ),
      );
    });
  }

  it("mounting the sidebar and mobile nav together makes one summary request, and both get the data", async () => {
    render("/doctor/patients");
    await settle();

    expect(summaryCalls()).toBe(1);
    expect(calls.filter((u) => u === "/api/v1/chat/threads")).toHaveLength(1);
    expect(seen.sidebar).toBe(43);
    expect(seen.mobile).toBe(43);
  });

  it("window focus triggers exactly one more shared request", async () => {
    render("/doctor/patients");
    await settle();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await settle();
    expect(summaryCalls()).toBe(2);
  });

  it("a route change (refreshKey) still refreshes, with one request", async () => {
    render("/doctor/patients");
    await settle();
    render("/doctor/requests");
    await settle();
    expect(summaryCalls()).toBe(2);
  });

  it("a disabled sidebar (unverified doctor) does not fetch on its own", async () => {
    act(() => {
      root.render(createElement(Probe, { name: "sidebar", options: { enabled: false } }));
    });
    await settle();
    expect(summaryCalls()).toBe(0);
  });
});
