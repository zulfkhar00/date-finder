// Pure helpers for traffic capture (server side of /api/event) and for reading it back in the
// admin. No I/O, no "server-only", so scripts/check-admin-analytics.ts can import it directly.
//
// Privacy: only coarse values are ever kept: a device class, a referrer HOST (no path, no query),
// a landing PATH (no query), and a 2-letter country if the proxy already sent one. The full user
// agent and the IP address are read, reduced, and dropped; neither is stored or logged.

import { PRODUCTION_HOSTS, PROBE_SESSION_PREFIX } from "@/lib/internal-traffic";

export const DEVICES = ["mobile", "tablet", "desktop", "bot"] as const;
export type Device = (typeof DEVICES)[number];

export const REFERRER_RAW_MAX = 512;
export const REFERRER_HOST_MAX = 100;
export const LANDING_PATH_MAX = 120;

const BOT_PATTERN = /bot\b|bot\/|crawler|spider|crawling|headless|lighthouse|slurp|facebookexternalhit|ahrefs|semrush|mj12|dataprovider|pingdom|uptime|python-requests|curl\/|wget\/|pagespeed|prerender|bingpreview|inspectiontool|node-fetch|axios\/|go-http-client|okhttp\/|scrapy/i;
const TABLET_PATTERN = /ipad|tablet|kindle|silk\/|playbook|(android(?!.*mobile))/i;
const MOBILE_PATTERN = /mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i;

/** mobile / tablet / desktop / bot from a User-Agent. null when there is no UA to look at. */
export function parseDevice(userAgent: string | null | undefined): Device | null {
  const ua = (userAgent ?? "").trim();
  if (!ua) return null;
  if (BOT_PATTERN.test(ua)) return "bot";
  if (TABLET_PATTERN.test(ua)) return "tablet";
  if (MOBILE_PATTERN.test(ua)) return "mobile";
  return "desktop";
}

const stripWww = (host: string) => host.replace(/^www\./, "");

/**
 * Host of an external referrer, lowercased, without "www.". Returns null for: nothing, an invalid
 * URL, non-http(s), localhost, and self-referrals (any of our own hosts, plus `extraSelfHosts`).
 */
export function referrerHost(raw: unknown, extraSelfHosts: readonly (string | undefined)[] = []): string | null {
  if (typeof raw !== "string" || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw.slice(0, REFERRER_RAW_MAX));
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = stripWww(url.hostname.toLowerCase());
  if (!host || host === "localhost" || host.length > REFERRER_HOST_MAX) return null;
  const own = new Set([...PRODUCTION_HOSTS, ...extraSelfHosts].filter((h): h is string => Boolean(h)).map((h) => stripWww(h.toLowerCase())));
  return own.has(host) ? null : host;
}

/** Path of the landing page only: no query, no fragment, capped. Anything that is not a path is null. */
export function cleanLandingPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/)[0].trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\u0000-\u001f\u007f\s]/.test(path)) return null;
  return path.slice(0, LANDING_PATH_MAX);
}

/** Two-letter country from the proxy's geo header, if there is one (Cloudflare, Vercel). Else null. */
export function countryFromHeaders(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country");
  const code = raw?.trim().toUpperCase();
  // XX = unknown, T1 = Tor in Cloudflare's scheme.
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}

// ---------- In-app browsers (source guess when there is no UTM and no referrer) ----------

// Social apps open links in their own webview and almost never send a Referer, so these visits would
// all read as "direct". Their User-Agent names the app. Order matters: Threads and Instagram share
// a codebase, Messenger rides on the Facebook SDK. Only the app NAME is kept, never the UA.
const IN_APP_RULES: [RegExp, string][] = [
  [/\bBarcelona\b/, "threads"],
  [/\bInstagram\b/, "instagram"],
  [/FBAN|FBAV|FB_IAB/, "facebook"],
  [/musical_ly|BytedanceWebview|TikTok|\btrill\b/i, "tiktok"],
  [/LinkedInApp/, "linkedin"],
  [/Snapchat/, "snapchat"],
  [/Twitter for|TwitterAndroid|\bTwitter\b/, "x"],
  [/\bTelegram\b|Telegram-Android/i, "telegram"],
  [/\bWhatsApp\b/, "whatsapp"]
];

/** The app whose in-app browser sent this User-Agent, as a channel name. Crawlers are never an app. null = none recognised. */
export function inAppSource(userAgent: string | null | undefined): string | null {
  const ua = (userAgent ?? "").trim();
  if (!ua || BOT_PATTERN.test(ua)) return null;
  for (const [pattern, name] of IN_APP_RULES) if (pattern.test(ua)) return name;
  return null;
}

export type TrafficFields = {
  /** In-app browser guess; only set when the visit has no utm_source and no external referrer. */
  in_app_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  referrer_host: string | null;
  landing_path: string | null;
  device: Device | null;
  country: string | null;
};

export const TRAFFIC_COLUMNS = ["in_app_source", "utm_source", "utm_medium", "utm_content", "referrer_host", "landing_path", "device", "country"] as const;

/** Everything the server derives from one /api/event request. UTM inputs are already cleaned; referrer and path are raw. */
export function trafficFromRequest(
  input: { utmSource?: string; utmMedium?: string; utmContent?: string; referrer?: unknown; landingPath?: unknown },
  headers: { get(name: string): string | null },
  selfHost?: string
): TrafficFields {
  const userAgent = headers.get("user-agent");
  const refHost = referrerHost(input.referrer, [selfHost]);
  return {
    // utm and a real referrer both beat the UA guess.
    in_app_source: input.utmSource || refHost ? null : inAppSource(userAgent),
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_content: input.utmContent ?? null,
    referrer_host: refHost,
    landing_path: cleanLandingPath(input.landingPath),
    device: parseDevice(userAgent),
    country: countryFromHeaders(headers)
  };
}

// ---------- Channel attribution (applied at report time, so rules can improve without rewriting rows) ----------

export const DIRECT_CHANNEL = "direct";
export const NOT_CAPTURED_CHANNEL = "(not captured)";

const CHANNEL_RULES: [RegExp, string][] = [
  [/^(ig|insta|instagram)([-_. ].*)?$|(^|\.)instagram\.com$/, "instagram"],
  [/^(tt|tiktok)([-_. ].*)?$|(^|\.)tiktok\.com$/, "tiktok"],
  [/^(fb|facebook|meta)([-_. ].*)?$|(^|\.)(facebook|fb)\.com$|^fb\.me$/, "facebook"],
  [/^(x|twitter)$|(^|\.)(x|twitter)\.com$|^t\.co$/, "x"],
  [/^reddit$|(^|\.)reddit\.com$/, "reddit"],
  [/^youtube$|(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/^threads$|(^|\.)threads\.(net|com)$/, "threads"],
  [/^google$|(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$|^bing$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/^(chatgpt|openai)$|(^|\.)(chatgpt\.com|chat\.openai\.com)$/, "chatgpt"],
  [/^perplexity$|(^|\.)perplexity\.ai$/, "perplexity"],
  [/^snapchat$|(^|\.)snapchat\.com$/, "snapchat"],
  [/^telegram$|(^|\.)(t\.me|telegram\.org)$/, "telegram"],
  [/^whatsapp$|(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/^linkedin$|(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/^(producthunt|product-hunt|product_hunt|ph)$|(^|\.)producthunt\.com$/, "producthunt"],
  [/^pinterest$|(^|\.)pinterest\.[a-z.]+$/, "pinterest"]
];

/** Folds the many spellings of one source (ig, l.instagram.com, Instagram) into one channel name. */
export function normalizeChannel(value: string): string {
  const v = value.trim().toLowerCase().replace(/^www\./, "");
  for (const [pattern, name] of CHANNEL_RULES) if (pattern.test(v)) return name;
  return v.slice(0, 60);
}

/** source = utm_source || referrer_host || in-app browser guess || "direct". */
export function resolveChannel(utmSource: string | null | undefined, refHost: string | null | undefined, inApp?: string | null): string {
  const source = utmSource?.trim() || refHost?.trim() || inApp?.trim();
  return source ? normalizeChannel(source) : DIRECT_CHANNEL;
}

// ---------- First touch (server-set cookie, 90 days) ----------

export const FIRST_TOUCH_COOKIE = "ns_ft";
export const FIRST_TOUCH_MAX_AGE = 60 * 60 * 24 * 90;

export type FirstTouch = { source: string; medium: string | null; campaign: string | null; landing: string | null };

const TOKEN = /^[\w.\-+ %/:()]{1,100}$/;
const clean = (v: unknown): string | null => (typeof v === "string" && TOKEN.test(v.trim()) ? v.trim().toLowerCase().slice(0, 100) : null);

/** The first-touch of a visit: utm, else referrer host, else in-app browser guess, else direct. Landing is a path only. */
export function firstTouchFromTraffic(t: Pick<TrafficFields, "utm_source" | "utm_medium" | "referrer_host" | "landing_path" | "in_app_source">, utmCampaign?: string | null): FirstTouch {
  const source = resolveChannel(t.utm_source, t.referrer_host, t.in_app_source);
  const medium = clean(t.utm_medium) ?? (t.utm_source ? null : t.referrer_host ? "referral" : t.in_app_source ? "in-app" : null);
  return { source, medium, campaign: clean(utmCampaign), landing: t.landing_path };
}

export function serializeFirstTouch(ft: FirstTouch): string {
  // Raw JSON: the cookie API percent-encodes it on the way out; parseFirstTouch decodes it on the way in.
  return JSON.stringify([ft.source, ft.medium, ft.campaign, ft.landing]);
}

/** Reads the ns_ft value out of a Cookie header (or a raw value). Anything malformed is null, never thrown. */
export function parseFirstTouch(cookieHeader: string | null | undefined): FirstTouch | null {
  if (!cookieHeader) return null;
  const part = cookieHeader.split(/;\s*/).find((p) => p.startsWith(`${FIRST_TOUCH_COOKIE}=`));
  if (!part) return null;
  try {
    const v: unknown = JSON.parse(decodeURIComponent(part.slice(FIRST_TOUCH_COOKIE.length + 1)));
    if (!Array.isArray(v)) return null;
    const source = clean(v[0]);
    if (!source) return null;
    const landing = cleanLandingPath(v[3]);
    return { source, medium: clean(v[1]), campaign: clean(v[2]), landing };
  } catch {
    return null;
  }
}

/** Do-Not-Track or Global Privacy Control: no first-touch cookie and nothing stored about it. */
export function privacySignal(headers: { get(name: string): string | null }): boolean {
  return headers.get("sec-gpc")?.trim() === "1" || headers.get("dnt")?.trim() === "1";
}

export type FirstTouchColumns = { first_touch_source: string | null; first_touch_medium: string | null; first_touch_campaign: string | null; first_touch_landing: string | null };

export function firstTouchColumns(ft: FirstTouch | null): FirstTouchColumns | Record<string, never> {
  if (!ft) return {};
  return { first_touch_source: ft.source, first_touch_medium: ft.medium, first_touch_campaign: ft.campaign, first_touch_landing: ft.landing };
}

/**
 * Whether /api/event should set the first-touch cookie on this request: only on a page_view, only when none is set
 * (an existing first touch is never overwritten), never for crawlers or our own probe sessions, never with DNT / GPC.
 */
export function shouldSetFirstTouch(input: { event: string; sessionId: string; device: Device | null; cookieHeader: string | null; headers: { get(name: string): string | null } }): boolean {
  if (input.event !== "page_view" || input.device === "bot" || input.sessionId.startsWith(PROBE_SESSION_PREFIX)) return false;
  if (privacySignal(input.headers)) return false;
  return parseFirstTouch(input.cookieHeader) === null;
}
