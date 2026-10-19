import { withSerwist } from "@serwist/turbopack";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/pdfkit/js/data/**/*",
      "./public/logo1.png",
      "./public/icon-192.png",
      "./public/icon-192-maskable.png",
      "./public/icon-512.png",
      "./public/icon-512-maskable.png",
    ],
  },
  transpilePackages: [
    "@zindagi/shared",
    "@zindagi/database",
    "@zindagi/validators",
  ],
  serverExternalPackages: ["mongoose", "redis", "@redis/client", "bcryptjs", "pdfkit", "fontkit", "browserslist"],
  turbopack: {},
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules[\\/]browserslist/ },
    ];
    return config;
  },
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
    formats: ["image/avif", "image/webp"],
    unoptimized: true,
  },
};

export default withSerwist(nextConfig);
