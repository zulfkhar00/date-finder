import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  // Ahrefs checks its verification file without the .html extension.
  async rewrites() {
    return [
      {
        source: "/ahrefs_1ba1e93fe7268cfeaa70ac916e7eafffe0ada83b0ff4280c85ad8a9538c31523",
        destination: "/ahrefs_1ba1e93fe7268cfeaa70ac916e7eafffe0ada83b0ff4280c85ad8a9538c31523.html",
      },
    ];
  },
};

// Source maps are uploaded to Sentry only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are
// all present at build time. Without them the build skips upload and never fails.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
const release = process.env.GIT_SHA;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { disable: !uploadSourceMaps, deleteSourcemapsAfterUpload: true },
  release: release ? { name: release, create: uploadSourceMaps, finalize: uploadSourceMaps } : { create: false, finalize: false },
  errorHandler: (error: Error) => {
    console.warn(`Sentry build step failed; continuing without it: ${error.message}`);
  },
});
