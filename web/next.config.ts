import path from "node:path";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    // Cache market API responses for 30 minutes offline
    runtimeCaching: [
      {
        urlPattern: /^https?.*\/api\/market/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "market-data-cache",
          expiration: { maxEntries: 20, maxAgeSeconds: 30 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.geojson$/,
        handler: "CacheFirst",
        options: {
          cacheName: "geojson-cache",
          expiration: { maxEntries: 5, maxAgeSeconds: 7 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "map-tiles-cache",
          expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  compress: true,
  // Pin the workspace root to web/ — the stray root-level package-lock.json
  // makes Turbopack misinfer the root, which triggered a realpath/aggregation panic.
  turbopack: { root: path.resolve(__dirname) },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    // Next 16 requires non-default quality values to be allow-listed.
    qualities: [75, 90, 95],
  },
};

export default withPWA(nextConfig);
