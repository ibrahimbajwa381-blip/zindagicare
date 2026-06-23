import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

function buildRevision(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  const hash = result.stdout?.trim();
  return hash || crypto.randomUUID();
}

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/~offline", revision: buildRevision() }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
