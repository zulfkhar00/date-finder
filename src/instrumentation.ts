import * as Sentry from "@sentry/nextjs";

// Server and Edge error monitoring. Dormant unless SENTRY_DSN is set at runtime.
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { sentryOptions } = await import("@/lib/sentry-options");
    Sentry.init(sentryOptions(dsn));
  }
}

// No-op when Sentry was not initialised.
export const onRequestError = Sentry.captureRequestError;
