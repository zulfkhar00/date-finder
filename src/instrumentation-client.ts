import * as Sentry from "@sentry/nextjs";
import { initAnalytics, trackRoute } from "@/lib/analytics";
import { sentryOptions } from "@/lib/sentry-options";

// Runs before hydration. Each tool is dormant unless its NEXT_PUBLIC_ key was set at build time.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
try {
  if (sentryDsn) Sentry.init(sentryOptions(sentryDsn));
} catch {
  // Monitoring must never break the page.
}

initAnalytics();

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  if (sentryDsn) Sentry.captureRouterTransitionStart(url, navigationType);
  trackRoute(url);
}
