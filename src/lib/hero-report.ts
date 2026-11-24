// Pure report for the home hero A/B test (/admin/traffic). Built on the same session model as the rest of the
// traffic page, so the same exclusions apply: bots, suspect sessions (unless toggled), founders, test emails,
// Stripe test checkouts, probe sessions and QA previews (?v=a|b) are all out.
//
// A session is in the test when it landed on "/" and carries a hero-a / hero-b variant. Checkouts and paid come
// from reservations linked to the session through the Stripe Checkout Session id (cohort view: the session's
// first visit is inside the range, whenever the payment happened).

import { HERO_LABELS } from "@/lib/hero-experiment";
import type { TrafficModel } from "@/lib/traffic-report";

export type HeroSegment = "all" | "desktop" | "mobile";
export const HERO_SEGMENTS: HeroSegment[] = ["all", "desktop", "mobile"];

/** Sessions needed in EACH arm of a segment before a result may be called. At a 17% baseline this detects roughly 17% -> 25%. */
export const HERO_MIN_PER_ARM = 300;
export const HERO_ALPHA = 0.05;

export type HeroArm = {
  sessions: number;
  /** Clicked "Get started" (event get_started). */
  getStarted: number;
  /** Onboarding started: the basics screen was shown (reserve_start). The primary metric. */
  started: number;
  /** Basics done: the email screen was reached (reserve_step_2). */
  basics: number;
  /** Signed in with the emailed code (reserve_step_3). */
  signedIn: number;
  /** Onboarding complete (consent given). */
  done: number;
  checkouts: number;
  paid: number;
};

export type HeroVerdict =
  | { kind: "collecting"; needed: number }
  | { kind: "none"; p: number }
  | { kind: "winner"; winner: "a" | "b"; p: number };

export type HeroRow = { segment: HeroSegment; a: HeroArm; b: HeroArm; pValue: number | null; verdict: HeroVerdict };

const emptyArm = (): HeroArm => ({ sessions: 0, getStarted: 0, started: 0, basics: 0, signedIn: 0, done: 0, checkouts: 0, paid: 0 });

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). */
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Two-sided p-value of a pooled two-proportion z-test; null when it cannot be computed. */
export function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (x2 / n2 - x1 / n1) / se;
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
}

export function heroVerdict(a: HeroArm, b: HeroArm, minPerArm = HERO_MIN_PER_ARM): { pValue: number | null; verdict: HeroVerdict } {
  const pValue = twoProportionP(a.started, a.sessions, b.started, b.sessions);
  const smaller = Math.min(a.sessions, b.sessions);
  if (smaller < minPerArm) return { pValue, verdict: { kind: "collecting", needed: minPerArm - smaller } };
  if (pValue === null || pValue >= HERO_ALPHA) return { pValue, verdict: { kind: "none", p: pValue ?? 1 } };
  const winner = b.started / b.sessions > a.started / a.sessions ? "b" : "a";
  return { pValue, verdict: { kind: "winner", winner, p: pValue } };
}

export function heroExperiment(model: TrafficModel, fromMs: number, toMs: number): HeroRow[] {
  const arms: Record<HeroSegment, { a: HeroArm; b: HeroArm }> = {
    all: { a: emptyArm(), b: emptyArm() },
    desktop: { a: emptyArm(), b: emptyArm() },
    mobile: { a: emptyArm(), b: emptyArm() }
  };
  const armsFor = (device: string | null, variant: string): HeroArm[] => {
    const key = variant === HERO_LABELS.b ? "b" : "a";
    const out = [arms.all[key]];
    if (device === "desktop") out.push(arms.desktop[key]);
    if (device === "mobile") out.push(arms.mobile[key]);
    return out;
  };

  const inTest = new Map<string, { device: string | null; variant: string }>();
  for (const s of model.sessions.values()) {
    if (!s.heroVariant || s.landing !== "/" || !s.pageView || s.firstAt < fromMs || s.firstAt >= toMs) continue;
    inTest.set(s.id, { device: s.device, variant: s.heroVariant });
    for (const arm of armsFor(s.device, s.heroVariant)) {
      arm.sessions += 1;
      if (s.getStarted) arm.getStarted += 1;
      if (s.opened) arm.started += 1;
      if (s.step2) arm.basics += 1;
      if (s.step3) arm.signedIn += 1;
      if (s.done) arm.done += 1;
    }
  }
  for (const r of model.reservations) {
    const sid = r.stripe_checkout_session_id ? model.stripeToSession.get(r.stripe_checkout_session_id) : undefined;
    const hit = sid ? inTest.get(sid) : undefined;
    if (!hit) continue;
    for (const arm of armsFor(hit.device, hit.variant)) {
      arm.checkouts += 1;
      if (r.status === "paid") arm.paid += 1;
    }
  }
  return HERO_SEGMENTS.map((segment) => ({ segment, ...arms[segment], ...heroVerdict(arms[segment].a, arms[segment].b) }));
}
