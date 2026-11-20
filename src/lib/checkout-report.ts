// The admin "Checkout" panel: for every Checkout Session opened in the window, how far did it get and,
// when it did not pay, why. Pure (rows in, numbers out); the loader is src/app/admin/_lib/checkout-data.ts.
// Importing real-funnel pulls in "server-only", so run the tests with --conditions=react-server.
//
// Real users only, same exclusions as the rest of /admin: founder / test-email / junk-email and
// Stripe test-mode reservations (and every funnel session tied to them), probe sessions
// (00000000-...), bot devices, and webhook rows from Stripe test mode (detail.test).

import { checkoutIdFromKey, failureLabel, type CheckoutDetail } from "@/lib/checkout-events";
import { internalSessionIds, splitReservations, type ReservationRow } from "@/lib/real-funnel";

const DAY = 24 * 60 * 60 * 1000;

export type CheckoutEventRow = {
  created_at: string;
  event: string;
  session_id: string | null;
  dedupe_key: string | null;
  device?: string | null;
  country?: string | null;
  detail?: CheckoutDetail | null;
};

export type CheckoutStep = { key: "opened" | "ready" | "submitted" | "paid"; label: string; count: number; pctOfOpened: number | null; pctOfPrevious: number | null };
export type FailureRow = { reason: string; source: "stripe" | "browser"; attempts: number; checkouts: number; recovered: number };
export type CheckoutDimRow = { key: string; opened: number; ready: number; submitted: number; paid: number; failed: number };
export type CheckoutOutcomes = { paid: number; failed: number; expired: number; left: number; open: number };

export type CheckoutReport = {
  sinceDays: number;
  steps: CheckoutStep[];
  outcomes: CheckoutOutcomes;
  failures: FailureRow[];
  byCountry: CheckoutDimRow[];
  byDevice: CheckoutDimRow[];
  /** Card issuing country of Stripe-reported failures (attempts). */
  failedCardCountries: { key: string; attempts: number }[];
  /** Paid checkouts the browser never reported on: ad blocker, or paid before this tracking shipped. */
  paidWithoutBrowserEvents: number;
  /** Failure rows Stripe sent that could not be tied to a Checkout Session. */
  unlinkedFailures: number;
  excluded: { bots: number; internal: number; stripeTest: number };
};

type Failure = { source: "stripe" | "browser"; reason: string; cardCountry: string | null };
type Checkout = {
  id: string;
  createdAt: number | null;
  firstAt: number;
  device: string | null;
  country: string | null;
  created: boolean;
  ready: boolean;
  submitted: boolean;
  paid: boolean;
  closed: boolean;
  expired: boolean;
  browserEvents: boolean;
  failures: Failure[];
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/** Reservations our own integration runs left behind: city "Integration test". Treated like any example.test address. */
const INTEGRATION_CITY = /integration test/i;

export function computeCheckoutReport(events: CheckoutEventRow[], reservationRows: (ReservationRow & { city?: string | null })[], now = new Date(), sinceDays = 30): CheckoutReport {
  const sinceMs = now.getTime() - sinceDays * DAY;
  const allReservations = reservationRows.map((r) => (r.city && INTEGRATION_CITY.test(r.city) ? { ...r, email: "integration-test@example.test" } : r));
  const { real, badStripeSessions } = splitReservations(allReservations, null, null);
  const internal = internalSessionIds(events, badStripeSessions);
  const excluded = { bots: 0, internal: 0, stripeTest: 0 };
  // A checkout any of whose rows belongs to a probe session or a bot is not a real user's, even when
  // its reservation (which carries no device or session) looks ordinary.
  const excludedIds = new Set<string>();

  const checkouts = new Map<string, Checkout>();
  const unlinked: Failure[] = [];
  const entry = (id: string, at: number): Checkout => {
    let c = checkouts.get(id);
    if (!c) {
      c = { id, createdAt: null, firstAt: at, device: null, country: null, created: false, ready: false, submitted: false, paid: false, closed: false, expired: false, browserEvents: false, failures: [] };
      checkouts.set(id, c);
    }
    c.firstAt = Math.min(c.firstAt, at);
    return c;
  };

  const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  for (const e of sorted) {
    const at = Date.parse(e.created_at);
    if (Number.isNaN(at)) continue;
    const id = e.detail?.checkout_id ?? checkoutIdFromKey(e.dedupe_key);
    if (!isCheckoutRelevant(e.event)) continue;
    if (e.session_id && internal.has(e.session_id)) { if (id) excludedIds.add(id); if (at >= sinceMs) excluded.internal += 1; continue; }
    if (e.device === "bot") { if (id) excludedIds.add(id); if (at >= sinceMs) excluded.bots += 1; continue; }
    if (e.detail?.test || (id && (id.startsWith("cs_test_") || badStripeSessions.has(id)))) { if (at >= sinceMs) excluded.stripeTest += 1; continue; }

    if (e.event === "stripe_payment_failed") {
      const failure: Failure = { source: "stripe", reason: failureLabel(e.detail ?? {}), cardCountry: e.detail?.card_country ?? null };
      if (!id) { if (at >= sinceMs) unlinked.push(failure); continue; }
      const c = entry(id, at);
      c.failures.push(failure);
      c.device ??= e.device ?? null;
      c.country ??= e.country ?? null;
      continue;
    }
    if (!id) continue;
    const c = entry(id, at);
    switch (e.event) {
      case "checkout_created":
        c.created = true; c.createdAt = at; c.device = e.device ?? c.device; c.country = e.country ?? c.country; break;
      case "paid": c.paid = true; break;
      case "stripe_session_expired": c.expired = true; break;
      case "checkout_form_ready": c.ready = true; c.browserEvents = true; break;
      case "payment_submit": c.submitted = true; c.browserEvents = true; break;
      case "checkout_form_error": c.browserEvents = true; c.failures.push({ source: "browser", reason: `load: ${e.detail?.code ?? "unknown"}`, cardCountry: null }); break;
      case "payment_error": c.browserEvents = true; c.failures.push({ source: "browser", reason: `browser: ${e.detail?.code ?? "unknown"}`, cardCountry: null }); break;
      case "checkout_closed": c.closed = true; c.browserEvents = true; break;
    }
  }

  // Reservations are the source of truth for "checkout opened" and "paid" (a paid event can be missing or late).
  for (const r of real) {
    const id = r.stripe_checkout_session_id;
    if (!id || excludedIds.has(id)) continue;
    const at = Date.parse(r.created_at);
    const c = entry(id, at);
    if (!c.created) { c.created = true; c.createdAt = at; }
    if (r.status === "paid" || r.status === "refunded") c.paid = true;
  }

  const inWindow = [...checkouts.values()].filter((c) => c.created && !excludedIds.has(c.id) && (c.createdAt ?? c.firstAt) >= sinceMs);
  // Funnel steps are monotonic: a payment implies a submit, a submit implies the form was there.
  for (const c of inWindow) {
    const failedAttempt = c.failures.some((f) => f.source === "stripe" || f.reason.startsWith("browser:"));
    c.submitted = c.submitted || c.paid || failedAttempt;
    c.ready = c.ready || c.submitted;
  }

  const outcomeOf = (c: Checkout): keyof CheckoutOutcomes => (c.paid ? "paid" : c.failures.length > 0 ? "failed" : c.expired ? "expired" : c.closed ? "left" : "open");
  const outcomes: CheckoutOutcomes = { paid: 0, failed: 0, expired: 0, left: 0, open: 0 };
  for (const c of inWindow) outcomes[outcomeOf(c)] += 1;

  const counts = [inWindow.length, inWindow.filter((c) => c.ready).length, inWindow.filter((c) => c.submitted).length, inWindow.filter((c) => c.paid).length];
  const labels: [CheckoutStep["key"], string][] = [["opened", "Checkout opened"], ["ready", "Payment form ready"], ["submitted", "Payment submitted"], ["paid", "Paid"]];
  const steps: CheckoutStep[] = labels.map(([key, label], i) => ({ key, label, count: counts[i], pctOfOpened: pct(counts[i], counts[0]), pctOfPrevious: i === 0 ? null : pct(counts[i], counts[i - 1]) }));

  // Failures: Stripe's account wins; browser-reported errors only count for checkouts Stripe said nothing about.
  const failureRows = new Map<string, FailureRow & { ids: Set<string>; recoveredIds: Set<string> }>();
  const addFailure = (f: Failure, id: string, recovered: boolean) => {
    const key = `${f.source}|${f.reason}`;
    let row = failureRows.get(key);
    if (!row) { row = { reason: f.reason, source: f.source, attempts: 0, checkouts: 0, recovered: 0, ids: new Set(), recoveredIds: new Set() }; failureRows.set(key, row); }
    row.attempts += 1;
    row.ids.add(id);
    if (recovered) row.recoveredIds.add(id);
  };
  const cardCountries = new Map<string, number>();
  for (const c of inWindow) {
    const stripeFailures = c.failures.filter((f) => f.source === "stripe");
    for (const f of stripeFailures.length > 0 ? stripeFailures : c.failures) addFailure(f, c.id, c.paid);
    for (const f of stripeFailures) cardCountries.set(f.cardCountry ?? "unknown", (cardCountries.get(f.cardCountry ?? "unknown") ?? 0) + 1);
  }
  unlinked.forEach((f, i) => {
    addFailure(f, `unlinked:${i}`, false);
    cardCountries.set(f.cardCountry ?? "unknown", (cardCountries.get(f.cardCountry ?? "unknown") ?? 0) + 1);
  });
  const failures: FailureRow[] = [...failureRows.values()]
    .map((r) => ({ reason: r.reason, source: r.source, attempts: r.attempts, checkouts: r.ids.size, recovered: r.recoveredIds.size }))
    .sort((a, b) => b.checkouts - a.checkouts || b.attempts - a.attempts || a.reason.localeCompare(b.reason));

  const byDim = (pick: (c: Checkout) => string | null): CheckoutDimRow[] => {
    const rows = new Map<string, CheckoutDimRow>();
    for (const c of inWindow) {
      const key = pick(c) ?? "unknown";
      let r = rows.get(key);
      if (!r) { r = { key, opened: 0, ready: 0, submitted: 0, paid: 0, failed: 0 }; rows.set(key, r); }
      r.opened += 1;
      if (c.ready) r.ready += 1;
      if (c.submitted) r.submitted += 1;
      if (c.paid) r.paid += 1;
      if (outcomeOf(c) === "failed") r.failed += 1;
    }
    return [...rows.values()].sort((a, b) => b.opened - a.opened || a.key.localeCompare(b.key));
  };

  return {
    sinceDays,
    steps,
    outcomes,
    failures,
    byCountry: byDim((c) => c.country),
    byDevice: byDim((c) => c.device),
    failedCardCountries: [...cardCountries].map(([key, attempts]) => ({ key, attempts })).sort((a, b) => b.attempts - a.attempts || a.key.localeCompare(b.key)),
    paidWithoutBrowserEvents: inWindow.filter((c) => c.paid && !c.browserEvents).length,
    unlinkedFailures: unlinked.length,
    excluded
  };
}

function isCheckoutRelevant(event: string): boolean {
  return event === "checkout_created" || event === "paid" || event === "stripe_payment_failed" || event === "stripe_session_expired"
    || event === "checkout_form_ready" || event === "checkout_form_error" || event === "payment_submit" || event === "payment_error" || event === "checkout_closed";
}
