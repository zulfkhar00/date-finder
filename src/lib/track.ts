// Funnel tracking hook points for the landing page and reserve flow.
//
// Browser funnel events sent to /api/event (funnel_events): page_view, get_started (any
// "Get started" CTA), reserve_start, onboarding_complete (answers done, reached checkout step),
// checkout_canceled. The same steps also go to PostHog when it is configured. The rest are hook points. Never pass emails, names, chat text or anything a
// visitor typed.

import { trackEvent } from "@/lib/attribution-client";
import { track as trackAnalytics } from "@/lib/analytics";

export type TrackEvent =
  | "page_view" // landing page view (recorded)
  | "reserve_start" // reserve form opened, once per tab session (recorded)
  | "checkout_canceled" // returned from Stripe without paying (recorded)
  | "cta_click" // a "Get started" button (recorded as get_started); props.location says which one
  | "demo_pick" // visitor picked a dead-chat example in the demo
  | "demo_fix" // visitor pressed "Fix my text"
  | "demo_bio" // visitor toggled the bio before/after
  | "onboarding_started" // onboarding form opened (PostHog)
  | "onboarding_completed" // onboarding answers done, reached the $1 step (PostHog)
  | "reserve_step" // reserve form advanced to props.step (1-based) (PostHog)
  | "checkout_submit" // reserve form sent to /api/checkout (PostHog)
  | "share_copy"; // confirmation page copy-link

export type TrackProps = Record<string, string | number | boolean | undefined>;

export function track(event: TrackEvent, props?: TrackProps): void {
  if (typeof window === "undefined") return;
  switch (event) {
    case "page_view":
    case "checkout_canceled":
      trackEvent(event);
      return;
    case "reserve_start":
      trackEvent(event, { oncePerSession: true });
      return;
    case "cta_click":
      trackEvent("get_started");
      trackAnalytics("get_started");
      return;
    case "onboarding_started":
      trackAnalytics(event);
      return;
    case "onboarding_completed":
      trackEvent("onboarding_complete", { oncePerSession: true });
      trackAnalytics(event);
      return;
    case "reserve_step":
    case "checkout_submit":
      // PostHog only (no funnel_events schema change): shows which form step visitors drop at.
      trackAnalytics(event, { props: typeof props?.step === "number" ? { step: props.step } : undefined });
      return;
    default:
      // Not a recorded funnel event yet; ignored on purpose.
      return;
  }
}
