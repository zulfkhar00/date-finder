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

export function getFunnelSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
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

export function trackEvent(event: ClientEventName, options: { oncePerSession?: boolean } = {}) {
  try {
    if (options.oncePerSession && !firstTimeThisSession(event)) return;
    const attribution = captureAttribution();
    const body = JSON.stringify({ sessionId: getFunnelSessionId(), event, variant: attribution.variant, utmCampaign: attribution.utm_campaign, ref: attribution.ref });
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // Tracking must never affect the page.
  }
}
