/**
 * @jest-environment jsdom
 *
 * Route-group error boundaries: generic message, no server details, a working
 * Retry action, and one boundary per route group.
 */
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RouteError } from "@/components/errors/route-error";
import { getDictionary } from "@/i18n";
import { LocaleProvider } from "@/i18n/locale-provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

jest.mock("next/link", () => {
  const { createElement: h } = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: { href: string; children: import("react").ReactNode }) =>
      h("a", { href, ...rest }, children),
  };
});

describe("RouteError", () => {
  it("shows a generic message and digest, never the error message, and Retry calls unstable_retry", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const retry = jest.fn();
    const error = Object.assign(new Error("MongoServerError: connection to cluster0.secret.mongodb.net failed"), {
      digest: "1234567890",
    });

    act(() =>
      root.render(
        createElement(
          LocaleProvider,
          {
            initialLocale: "en",
            initialDictionary: getDictionary("en"),
            children: createElement(RouteError, { error, unstable_retry: retry }),
          },
        ),
      ),
    );

    const text = container.textContent ?? "";
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(text).toContain("Something went wrong");
    expect(text).toContain("1234567890");
    expect(text).not.toContain("MongoServerError");
    expect(text).not.toContain("mongodb.net");

    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Try again");
    expect(button).toBeDefined();
    act(() => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(retry).toHaveBeenCalledTimes(2);
    expect(button!.disabled).toBe(false);

    act(() => root.unmount());
  });

  it("every route group has an error.tsx client boundary using RouteError", () => {
    const appDir = path.join(__dirname, "../../../src/app");
    const groups = fs.readdirSync(appDir).filter((d) => /^\(.+\)$/.test(d));
    expect(groups.length).toBe(9);
    for (const group of groups) {
      const source = fs.readFileSync(path.join(appDir, group, "error.tsx"), "utf8");
      expect(source.startsWith('"use client"')).toBe(true);
      expect(source).toContain("RouteError as default");
    }
  });
});
