import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/pdfkit/js/data/**/*",
      "./public/logo1.png",
      "./public/icon-192.png",
    ],
  },
  transpilePackages: [
    "@zindagi/shared",
    "@zindagi/database",
    "@zindagi/validators",
  ],
  serverExternalPackages: ["mongoose", "bcryptjs", "pdfkit", "fontkit"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default withSerwist(nextConfig);
