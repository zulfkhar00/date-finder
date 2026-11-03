// Pure helpers for traffic capture (server side of /api/event) and for reading it back in the
// admin. No I/O, no "server-only", so scripts/check-admin-analytics.ts can import it directly.
//
// Privacy: only coarse values are ever kept: a device class, a referrer HOST (no path, no query),
// a landing PATH (no query), and a 2-letter country if the proxy already sent one. The full user
// agent and the IP address are read, reduced, and dropped; neither is stored or logged.

import { PRODUCTION_HOSTS } from "@/lib/internal-traffic";

export const DEVICES = ["mobile", "tablet", "desktop", "bot"] as const;
export type Device = (typeof DEVICES)[number];

export const REFERRER_RAW_MAX = 512;
export const REFERRER_HOST_MAX = 100;
export const LANDING_PATH_MAX = 120;

const BOT_PATTERN = /bot\b|bot\/|crawler|spider|crawling|headless|lighthouse|slurp|facebookexternalhit|ahrefs|semrush|mj12|dataprovider|pingdom|uptime|python-requests|curl\/|wget\//i;
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

export type TrafficFields = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  referrer_host: string | null;
  landing_path: string | null;
  device: Device | null;
  country: string | null;
};

export const TRAFFIC_COLUMNS = ["utm_source", "utm_medium", "utm_content", "referrer_host", "landing_path", "device", "country"] as const;

/** Everything the server derives from one /api/event request. UTM inputs are already cleaned; referrer and path are raw. */
export function trafficFromRequest(
  input: { utmSource?: string; utmMedium?: string; utmContent?: string; referrer?: unknown; landingPath?: unknown },
  headers: { get(name: string): string | null },
  selfHost?: string
): TrafficFields {
  return {
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_content: input.utmContent ?? null,
    referrer_host: referrerHost(input.referrer, [selfHost]),
    landing_path: cleanLandingPath(input.landingPath),
    device: parseDevice(headers.get("user-agent")),
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
  [/^linkedin$|(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/^pinterest$|(^|\.)pinterest\.[a-z.]+$/, "pinterest"]
];

/** Folds the many spellings of one source (ig, l.instagram.com, Instagram) into one channel name. */
export function normalizeChannel(value: string): string {
  const v = value.trim().toLowerCase().replace(/^www\./, "");
  for (const [pattern, name] of CHANNEL_RULES) if (pattern.test(v)) return name;
  return v.slice(0, 60);
}

/** source = utm_source || referrer_host || "direct". */
export function resolveChannel(utmSource: string | null | undefined, refHost: string | null | undefined): string {
  const source = utmSource?.trim() || refHost?.trim();
  return source ? normalizeChannel(source) : DIRECT_CHANNEL;
}
