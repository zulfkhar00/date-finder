import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";
import { scrubDeep } from "@/lib/scrub";

// Shared Sentry options for the browser, Node.js and Edge runtimes. Sentry is only initialised when
// a DSN is configured; without one the SDK stays dormant and sends nothing.
//
// Sentry v11 removed `sendDefaultPii`; `dataCollection` replaces it and its defaults collect
// everything (bodies, cookies, headers, local variables). This is the strict equivalent of
// `sendDefaultPii: false`: no user info, cookies, request/response bodies (the checkout body holds
// the email), DB or AI payloads, or stack-frame locals. The `beforeSend*` hooks then redact emails and
// Checkout session ids from whatever remains, in events, spans and breadcrumbs.
export function sentryOptions(dsn: string): BrowserOptions & NodeOptions & EdgeOptions {
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type", "referer"] }, response: false },
      httpBodies: [],
      urlQueryParams: { deny: ["session_id", "email"] },
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false
    },
    beforeSend: (event) => scrubDeep(event),
    beforeSendSpan: (span) => scrubDeep(span),
    beforeBreadcrumb: (breadcrumb) => scrubDeep(breadcrumb)
  };
}
