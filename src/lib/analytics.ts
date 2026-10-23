import posthog from "posthog-js";
import { scrubDeep } from "@/lib/scrub";

// Product analytics (PostHog). Every export is a no-op unless NEXT_PUBLIC_POSTHOG_KEY was set at
// build time, the code runs in a browser, and the visitor has not enabled Do Not Track.
// Staff surfaces (/admin, including /admin/concierge) are never tracked: PostHog is not initialised when the first
// page is one of them, and any event whose URL is one of them is dropped before it is sent.
// Event names match the server-side funnel (PR #1) so both sources line up.
export type FunnelEvent = "page_view" | "reserve_start" | "checkout_created" | "checkout_canceled" | "paid";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
let ready = false;

const PRIVATE_PREFIXES = ["/admin"];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function pathOf(href: string): string | null {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function isPrivateUrl(href: unknown): boolean {
  if (typeof href !== "string") return false;
  const pathname = pathOf(href);
  return pathname === null || isPrivatePath(pathname);
}

// `href` is the URL about to be shown (defaults to the current one). Safe to call repeatedly: a
// visitor who lands on /admin and then navigates to a public page gets initialised at that point.
// Returns true only on the call that initialised PostHog (that call already tracked `href`).
export function initAnalytics(href?: string): boolean {
  if (!key || typeof window === "undefined" || ready) return false;
  if (isPrivateUrl(href ?? window.location.href)) return false;
  try {
    posthog.init(key, {
      api_host: host,
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      respect_dnt: true,
      capture_pageview: "history_change",
      autocapture: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      disable_session_recording: true,
      session_recording: { maskAllInputs: true },
      disable_surveys: true,
      capture_exceptions: false,
      before_send: (event) => {
        if (!event) return event;
        if (isPrivateUrl(event.properties?.$current_url ?? window.location.href)) return null;
        return scrubDeep(event);
      }
    });
    ready = true;
    trackRoute(href ?? window.location.href);
    return true;
  } catch {
    // Analytics must never break the page.
    return false;
  }
}

export function track(event: FunnelEvent, options?: { instant?: boolean }) {
  if (!ready) return;
  try {
    posthog.capture(event, undefined, options?.instant ? { send_instantly: true } : undefined);
  } catch {
    // ignore
  }
}

// Fires an event at most once per browser for a given dedupe key (e.g. a reload of the paid page).
export function trackOnce(event: FunnelEvent, dedupeKey: string) {
  if (!ready) return;
  const storageKey = `ns_tracked:${dedupeKey}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage unavailable: fall through and track anyway.
  }
  track(event);
}

// Route-driven funnel steps, so shared page components stay untouched:
// "/" -> page_view, "/reserve" -> reserve_start (once per tab session), "/reserve?cancelled=1" -> checkout_canceled.
export function trackRoute(href: string) {
  if (!ready) return;
  let url: URL;
  try { url = new URL(href, window.location.origin); } catch { return; }
  if (isPrivatePath(url.pathname)) return;
  if (url.pathname === "/") track("page_view");
  if (url.pathname === "/reserve") {
    if (url.searchParams.get("cancelled") === "1") track("checkout_canceled");
    try {
      if (window.sessionStorage.getItem("ns_reserve_start")) return;
      window.sessionStorage.setItem("ns_reserve_start", "1");
    } catch {
      // ignore
    }
    track("reserve_start");
  }
}
