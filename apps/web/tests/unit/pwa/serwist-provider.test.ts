import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const baseProvider = jest.fn<null, [Record<string, unknown>]>(() => null);
jest.mock("@serwist/turbopack/react", () => ({
  SerwistProvider: (props: Record<string, unknown>) => baseProvider(props),
}));

import { SerwistProvider } from "@/components/providers/serwist-provider";

describe("SerwistProvider", () => {
  beforeEach(() => baseProvider.mockClear());

  it("does not hard-reload the page when the connection comes back online", () => {
    renderToStaticMarkup(createElement(SerwistProvider, { swUrl: "/serwist/sw.js" }));
    expect(baseProvider).toHaveBeenCalledWith(
      expect.objectContaining({ swUrl: "/serwist/sw.js", reloadOnOnline: false }),
    );
  });
});
