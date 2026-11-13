import type { NextConfig } from "next";

process.env.BIBLE_JOURNEY_BUILD ??= process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: process.env.BIBLE_JOURNEY_BUILD,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
