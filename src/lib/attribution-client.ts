import { PROBE_SESSION_PREFIX } from "@/lib/internal-traffic";
import { attributionSchema, cleanVariant, UTM_KEYS, type Attribution, type ClientEventName } from "@/lib/attribution";

// Browser-only helpers. First-touch attribution lives in a first-party cookie (30 days) so a
// visitor who comes back later still counts toward the campaign that brought them. The funnel
// session id lives in sessionStorage (one per tab session). No third-party scripts.

const COOKIE = "ns_attr";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_KEY = "ns_sid";
const ONCE_PREFIX = "ns_once_";

function readCookie(): Attribution | null {
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCookie(value: Attribution) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function externalReferrer(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).origin === window.location.origin ? undefined : document.referrer;
  } catch {
    return undefined;
  }
}

/** Reads UTM/variant/referrer on the first landing and keeps them; later calls return the stored value. */
export function captureAttribution(): Attribution {
  const stored = readCookie();
  if (stored) return stored;
  const params = new URLSearchParams(window.location.search);
  const raw: Record<string, unknown> = { variant: params.get("variant") ?? params.get("v") ?? undefined, referrer: externalReferrer(), ref: params.get("ref") ?? undefined };
  for (const key of UTM_KEYS) raw[key] = params.get(key) ?? undefined;
  const parsed = attributionSchema.safeParse(raw);
  const value: Attribution = parsed.success ? parsed.data : { variant: cleanVariant(undefined), utm_source: undefined, utm_medium: undefined, utm_campaign: undefined, utm_content: undefined, utm_term: undefined, referrer: undefined, ref: undefined };
  try { writeCookie(value); } catch { /* cookies disabled */ }
  return value;
}

/**
 * Attributes an internal campaign link without overwriting a real first-touch campaign.
 * This lets an untagged search visitor who lands on a guide be credited to that guide
 * before the CTA click event is recorded.
 */
export function captureInternalLinkAttribution(href: string): Attribution {
  const stored = readCookie();
  if (stored && (stored.utm_source || stored.utm_medium || stored.utm_campaign)) return stored;

  try {
    const url = new URL(href, window.location.origin);
    const raw: Record<string, unknown> = {
      variant: stored?.variant ?? url.searchParams.get("variant") ?? url.searchParams.get("v") ?? undefined,
      referrer: stored?.referrer ?? externalReferrer(),
      ref: stored?.ref ?? url.searchParams.get("ref") ?? undefined
    };
    for (const key of UTM_KEYS) raw[key] = url.searchParams.get(key) ?? stored?.[key];
    const parsed = attributionSchema.safeParse(raw);
    if (!parsed.success) return stored ?? captureAttribution();
    try { writeCookie(parsed.data); } catch { /* cookies disabled */ }
    return parsed.data;
  } catch {
    return stored ?? captureAttribution();
  }
}

export function getFunnelSessionId(): string {
  // Founder/test browsers get a probe-prefixed id: their events are recorded (so we can prove the
  // funnel works end to end) but the real-funnel numbers drop every probe session.
  const internal = isInternalBrowser();
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.startsWith(PROBE_SESSION_PREFIX) === internal) return existing;
    const created = internal ? probeSessionId() : crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return internal ? probeSessionId() : crypto.randomUUID();
  }
}

/** Returns true the first time it is called for `key` in this tab session. */
function firstTimeThisSession(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(ONCE_PREFIX + key)) return false;
    window.sessionStorage.setItem(ONCE_PREFIX + key, "1");
    return true;
  } catch {
    return true;
  }
}

const INTERNAL_KEY = "ns_internal";

/**
 * Founder flag: open any page with ?internal=1 once on a device and that browser is marked
 * internal; ?internal=0 turns it back on as a normal visitor. Internal browsers still send funnel
 * events, under a probe session id (see getFunnelSessionId), so they never count as real users.
 */
function isInternalBrowser(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get("internal");
    if (flag === "1") window.localStorage.setItem(INTERNAL_KEY, "1");
    if (flag === "0") window.localStorage.removeItem(INTERNAL_KEY);
    return window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

export type TrackOptions = {
  oncePerSession?: boolean;
  /** Stripe Checkout Session id: required for the checkout_* / payment_* events. */
  checkoutId?: string;
  /** Whitelisted checkout detail; the server re-validates and drops anything else. */
  detail?: { code?: string; type?: string; paymentMethod?: string; reason?: string; seconds?: number };
  /** Prefer navigator.sendBeacon (survives the page going away); falls back to fetch keepalive. */
  beacon?: boolean;
};

/**
 * Sends a body to /api/event. sendBeacon first when asked (it is the only transport that reliably
 * survives pagehide on mobile Safari), then fetch with keepalive when sendBeacon is missing, refuses
 * the payload, or throws (some ad blockers make it return false). Never throws.
 */
export function postFunnelEvent(body: string, preferBeacon: boolean) {
  try {
    if (preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }))) return;
    }
  } catch {
    // fall through to fetch
  }
  try {
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // blocked outright: nothing more to try
  }
}

export function trackEvent(event: ClientEventName, options: TrackOptions = {}) {
  try {
    // Once-per-tab-session key: checkout events are once per Checkout Session (payment_error per code).
    const onceKey = [event, options.checkoutId, options.detail?.code].filter(Boolean).join(":");
    if (options.oncePerSession && !firstTimeThisSession(onceKey)) return;
    const attribution = captureAttribution();
    // Source hints ride on every event (first-touch cookie values); where the visit came from and
    // which page it landed on are only meaningful once, on page_view. The server reduces them.
    const landing = event === "page_view" ? { referrer: externalReferrer(), landingPath: window.location.pathname } : {};
    const body = JSON.stringify({
      sessionId: getFunnelSessionId(),
      event,
      variant: attribution.variant,
      utmCampaign: attribution.utm_campaign,
      ref: attribution.ref,
      utmSource: attribution.utm_source,
      utmMedium: attribution.utm_medium,
      utmContent: attribution.utm_content,
      ...(options.checkoutId ? { checkoutId: options.checkoutId, detail: options.detail } : {}),
      ...landing
    });
    postFunnelEvent(body, options.beacon === true);
  } catch {
    // Tracking must never affect the page.
  }
}

/** A valid UUID that starts with the probe prefix (the /api/event schema requires z.uuid()). */
function probeSessionId(): string {
  return PROBE_SESSION_PREFIX + crypto.randomUUID().slice(PROBE_SESSION_PREFIX.length);
}
