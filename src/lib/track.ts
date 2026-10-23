// Funnel tracking hook points for the landing page and reserve flow.
//
// Intentionally a no-op in this PR. The funnel-tracking PR (utm capture, /api/event) fills in
// the body; every call site already passes a stable event name plus small, non-personal props.
// Never pass emails, names, chat text or anything a visitor typed.

export type TrackEvent =
  | "cta_click" // a "$1 — get on the list" button; props.location says which one
  | "demo_pick" // visitor picked a dead-chat example in the demo
  | "demo_fix" // visitor pressed "Fix my text"
  | "demo_bio" // visitor toggled the bio before/after
  | "reserve_step" // reserve form advanced to props.step (1-based)
  | "checkout_submit" // reserve form sent to /api/checkout
  | "share_copy"; // confirmation page copy-link

export type TrackProps = Record<string, string | number | boolean | undefined>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function track(event: TrackEvent, props?: TrackProps): void {
  // no-op until the funnel-tracking PR lands
}
