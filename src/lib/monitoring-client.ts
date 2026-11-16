import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { initAnalytics, registerPostHog, trackRoute } from "@/lib/analytics";
import { sentryOptions } from "@/lib/sentry-options";

// Loaded by instrumentation-client.ts once the page has finished loading, so the Sentry and PostHog
// bundles never compete with hydration. Each tool is dormant unless its NEXT_PUBLIC_ key was set at build time.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
try {
  if (sentryDsn) Sentry.init(sentryOptions(sentryDsn));
} catch {
  // Monitoring must never break the page.
}

registerPostHog(posthog);
initAnalytics();

export function onTransition(url: string, navigationType: "push" | "replace" | "traverse") {
  if (sentryDsn) Sentry.captureRouterTransitionStart(url, navigationType);
  if (!initAnalytics(url)) trackRoute(url);
}
