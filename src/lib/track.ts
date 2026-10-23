// Funnel tracking hook points for the landing page and reserve flow.
//
// Only the three browser funnel events (page_view, reserve_start, checkout_canceled) are sent to
// /api/event via trackEvent. onboarding_started / onboarding_completed go to product analytics
// (PostHog) only, so no new event names reach the funnel_events table. The rest are hook points. Never pass emails, names, chat text or anything a
// visitor typed.

import { trackEvent } from "@/lib/attribution-client";
import { track as trackAnalytics } from "@/lib/analytics";

export type TrackEvent =
  | "page_view" // landing page view (recorded)
  | "reserve_start" // reserve form opened, once per tab session (recorded)
  | "checkout_canceled" // returned from Stripe without paying (recorded)
  | "cta_click" // a "Try it" button; props.location says which one
  | "demo_pick" // visitor picked a dead-chat example in the demo
  | "demo_fix" // visitor pressed "Fix my text"
  | "demo_bio" // visitor toggled the bio before/after
  | "onboarding_started" // onboarding form opened (PostHog)
  | "onboarding_completed" // onboarding answers done, reached the $1 step (PostHog)
  | "reserve_step" // reserve form advanced to props.step (1-based)
  | "checkout_submit" // reserve form sent to /api/checkout
  | "share_copy"; // confirmation page copy-link

export type TrackProps = Record<string, string | number | boolean | undefined>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    case "onboarding_started":
    case "onboarding_completed":
      trackAnalytics(event);
      return;
    default:
      // Not a recorded funnel event yet; ignored on purpose.
      return;
  }
}
