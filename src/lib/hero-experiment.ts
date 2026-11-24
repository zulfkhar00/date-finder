// Home hero A/B test. Pure helpers (no I/O, no server-only): used by the proxy (assignment), the browser
// attribution code (tagging events) and the admin report (reading them back).
//
// Assignment is server side in src/proxy.ts: a sticky 50/50 cookie (ns_hero = a | b) set on the first
// real request to "/". The variant is written into the existing `variant` field of every funnel event and
// reservation as hero-a / hero-b, so no schema change is needed and paid attribution follows the existing
// checkout_created -> reservation path.

import { isBotUserAgent } from "@/lib/bot-quality";

export const HERO_COOKIE = "ns_hero";
export const HERO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const HERO_VARIANTS = ["a", "b"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];
/** Value written to funnel_events.variant / reservations.variant. */
export const HERO_LABELS: Record<HeroVariant, string> = { a: "hero-a", b: "hero-b" };
/** Internal route that renders variant B; the proxy rewrites "/" to it (the URL stays "/"). */
export const HERO_B_PATH = "/exp/home-b";

export function parseHeroVariant(value: unknown): HeroVariant | null {
  return value === "a" || value === "b" ? value : null;
}

export function heroLabel(value: unknown): string | null {
  const parsed = parseHeroVariant(value);
  return parsed ? HERO_LABELS[parsed] : null;
}

export function isHeroLabel(value: unknown): value is string {
  return value === HERO_LABELS.a || value === HERO_LABELS.b;
}

export type HeroDecision = {
  variant: HeroVariant;
  /** True when the cookie must be written on this response. */
  setCookie: boolean;
  /** QA preview via ?v=a|b: never sets the cookie, and the browser marks the tab session as a probe so it is not counted. */
  forced: boolean;
};

/**
 * Pure decision for one request to "/". Bots (and requests with no User-Agent) always get A and no cookie, so
 * they are never in the test. `random` is injected for tests (0..1).
 */
export function decideHero(input: { userAgent: string | null; cookie: string | undefined; queryV: string | null; random: number }): HeroDecision {
  const forced = parseHeroVariant(input.queryV);
  if (forced) return { variant: forced, setCookie: false, forced: true };
  if (!input.userAgent || isBotUserAgent(input.userAgent)) return { variant: "a", setCookie: false, forced: false };
  const existing = parseHeroVariant(input.cookie);
  if (existing) return { variant: existing, setCookie: false, forced: false };
  return { variant: input.random < 0.5 ? "a" : "b", setCookie: true, forced: false };
}
