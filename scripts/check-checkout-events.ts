// Checkout diagnostics: schema + dedupe keys, Stripe -> detail mapping, the funnel writers against a
// fake Supabase (retries, out-of-order, missing columns, missing reservation), the admin report, and
// the forensics script. Run with: node --conditions=react-server --import tsx scripts/check-checkout-events.ts
import assert from "node:assert/strict";
import { clientEventSchema } from "../src/lib/attribution";
import { checkoutIdFromKey, clientDedupeKey, failureLabel, paymentFailureDetail, sessionEndDetail, cleanClientDetail } from "../src/lib/checkout-events";
import { computeCheckoutReport, type CheckoutEventRow } from "../src/lib/checkout-report";
import { funnelRowAttempts, insertClientFunnelEvent, noteReservationFailure, recordPaidEvent, recordStripeCheckoutEvent, recordFunnelEvent } from "../src/lib/funnel";
import type { ReservationRow } from "../src/lib/real-funnel";
import { countryFromHeaders, parseDevice, trafficFromRequest } from "../src/lib/traffic";
import { aggregate, outcomeOf, summarizeSession } from "./checkout-forensics.mjs";

const SID = "7b1f3c52-0a4e-4f6b-9c3d-2e8a1d5b6f70";
const CS = "cs_live_a1B2c3D4e5F6g7H8";
const CS2 = "cs_live_zZ9y8X7w6V5u4T3s";

// ---------- device + country (server side, every row) ----------
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const fromIndia = trafficFromRequest({}, h({ "user-agent": IPHONE, "x-vercel-ip-country": "in" }));
assert.equal(fromIndia.device, "mobile", "checkout_created gets device from the UA");
assert.equal(fromIndia.country, "IN", "and country from the geo header");
assert.equal(trafficFromRequest({}, h({ "user-agent": "Googlebot/2.1" })).device, "bot");
assert.equal(trafficFromRequest({}, h({ "user-agent": IPHONE })).country, null, "no geo header (local dev) is null, not an error");
assert.equal(countryFromHeaders(h({ "x-vercel-ip-country": "" })), null);
assert.equal(parseDevice(undefined), null);

// ---------- the browser contract ----------
const base = { sessionId: SID, variant: "noswipe" };
const ok = clientEventSchema.safeParse({ ...base, event: "payment_error", checkoutId: CS, detail: { code: "API_Error", type: "client", paymentMethod: "card", cardNumber: "4242424242424242", email: "a@b.c", seconds: 12.4 } });
assert.ok(ok.success);
assert.deepEqual(ok.data.detail, { checkout_id: CS, code: "api_error", type: "client", payment_method: "card", seconds: 12 }, "whitelist: unknown keys (card number, email) never survive");
assert.equal(clientEventSchema.safeParse({ ...base, event: "payment_submit" }).success, false, "checkout events need a checkoutId");
assert.equal(clientEventSchema.safeParse({ ...base, event: "payment_submit", checkoutId: "cs_live_x" }).success, false, "malformed checkoutId is rejected");
assert.equal(clientEventSchema.safeParse({ ...base, event: "payment_submit", checkoutId: "../../etc" }).success, false);
assert.ok(clientEventSchema.safeParse({ ...base, event: "page_view" }).success, "other events need no checkoutId");
assert.equal(clientEventSchema.safeParse({ ...base, event: "stripe_payment_failed", checkoutId: CS }).success, false, "server-only events cannot be sent by a browser");
assert.equal(clientEventSchema.safeParse({ ...base, event: "paid", checkoutId: CS }).success, false);
assert.deepEqual(cleanClientDetail({ code: "x".repeat(200), reason: "evil", seconds: -5 }, CS), { checkout_id: CS, seconds: 0 }, "bad tokens and reasons are dropped");
assert.deepEqual(cleanClientDetail("nonsense", undefined), {});

// ---------- dedupe: once per session per step ----------
assert.equal(clientDedupeKey("payment_submit", CS, {}), `payment_submit:${CS}`);
assert.equal(clientDedupeKey("checkout_closed", CS, { reason: "hidden" }), `checkout_closed:${CS}`);
assert.equal(clientDedupeKey("payment_error", CS, { code: "api_error" }), `payment_error:${CS}:api_error`);
assert.notEqual(clientDedupeKey("payment_error", CS, { code: "api_error" }), clientDedupeKey("payment_error", CS, { code: "user_cancelled" }), "a new failure code is a new fact");
assert.equal(checkoutIdFromKey(`payment_error:${CS}:api_error`), CS);
assert.equal(checkoutIdFromKey("evt_123"), null);
assert.equal(checkoutIdFromKey(null), null);

// ---------- Stripe -> detail mapping (webhook) ----------
const failedIntent = {
  id: "pi_3Abc", client_secret: "pi_secret_must_not_leak", receipt_email: "card@holder.in",
  last_payment_error: {
    code: "card_declined", decline_code: "do_not_honor", type: "card_error", message: "Your card was declined for Rahul Sharma",
    payment_method: { id: "pm_1", type: "card", billing_details: { name: "Rahul Sharma", email: "card@holder.in" }, card: { brand: "visa", country: "IN", funding: "debit", last4: "4242", exp_month: 1 } }
  }
};
const detail = paymentFailureDetail(failedIntent, true, CS);
assert.deepEqual(detail, { checkout_id: CS, code: "card_declined", decline_code: "do_not_honor", type: "card_error", payment_method: "card", card_brand: "visa", card_country: "IN", funding: "debit" });
const serialized = JSON.stringify(detail);
for (const secret of ["Rahul", "card@holder", "4242", "pi_3Abc", "pi_secret", "pm_1", "declined for"]) assert.ok(!serialized.includes(secret), `no PII/ids in detail: ${secret}`);
assert.equal(paymentFailureDetail(failedIntent, false, null).test, true, "test-mode rows are flagged");
assert.equal(paymentFailureDetail({ last_payment_error: null }, true).code, "unknown", "an intent with no error still maps");
assert.equal(failureLabel(detail), "card_declined / do_not_honor");
assert.equal(failureLabel({ code: "expired_card" }), "expired_card");
assert.deepEqual(sessionEndDetail("expired", CS, true, 86_400.4), { checkout_id: CS, seconds: 86_400 });
assert.equal(sessionEndDetail("async_payment_failed", CS, true).code, "async_payment_failed");

// ---------- row shapes + fallbacks when the migration is not applied ----------
const full = funnelRowAttempts({ event: "stripe_payment_failed", sessionId: SID, ref: "r1", traffic: { device: "mobile", country: "IN" }, detail: { code: "x" }, dedupeKey: "evt_1" });
assert.deepEqual(full.map((r) => ["detail" in r, "device" in r, "ref" in r]), [[true, true, true], [false, true, true], [false, false, true], [false, false, false]]);
assert.equal(funnelRowAttempts({ event: "paid" }).length, 1, "a plain event has one shape");
assert.equal("country" in funnelRowAttempts({ event: "paid", traffic: { device: null, country: null } })[0], false, "null traffic is not sent");

// ---------- the writers, against a fake Supabase ----------
type Row = Record<string, unknown>;
function fakeSupabase(missing: string[] = []) {
  const tables: Record<string, Row[]> = { funnel_events: [], reservations: [] };
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op = "select", payload: Row = {}, ignore = false;
    const q = {
      insert(row: Row) { op = "insert"; payload = row; return q; },
      upsert(row: Row, o: { ignoreDuplicates?: boolean }) { op = "upsert"; payload = row; ignore = Boolean(o?.ignoreDuplicates); return q; },
      update(p: Row) { op = "update"; payload = p; return q; },
      select() { return q; },
      eq(col: string, v: unknown) { filters.push((r) => r[col] === v); return q; },
      in(col: string, vs: unknown[]) { filters.push((r) => vs.includes(r[col])); return q; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }); },
      then(resolve: (v: unknown) => unknown) { return resolve(run()); }
    };
    function run(): { data: Row[] | null; error: { code: string } | null } {
      const rows = tables[table];
      if (op !== "select" && missing.some((c) => c in payload)) return { data: null, error: { code: "42703" } };
      if (op === "insert" || op === "upsert") {
        const dup = payload.dedupe_key != null && rows.some((r) => r.dedupe_key === payload.dedupe_key);
        if (dup) return op === "upsert" && ignore ? { data: [], error: null } : { data: null, error: { code: "23505" } };
        rows.push({ ...payload }); return { data: [{ id: rows.length }], error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") { hit.forEach((r) => Object.assign(r, payload)); return { data: hit.map((r) => ({ id: r.id })), error: null }; }
      return { data: hit, error: null };
    }
    return q;
  };
  return { client: { from } as never, tables };
}

async function main() {
  // origin + failure, delivered twice (webhook retry): one row, linked to the funnel session, device/country copied
  {
    const db = fakeSupabase();
    await recordFunnelEvent(db.client, { event: "checkout_created", sessionId: SID, traffic: { device: "mobile", country: "IN" }, dedupeKey: `checkout_created:${CS}` });
    const first = await recordStripeCheckoutEvent(db.client, { event: "stripe_payment_failed", stripeEventId: "evt_1", checkoutSessionId: CS, detail });
    const retry = await recordStripeCheckoutEvent(db.client, { event: "stripe_payment_failed", stripeEventId: "evt_1", checkoutSessionId: CS, detail });
    assert.equal(first, true); assert.equal(retry, false, "retry is a no-op");
    const rows = db.tables.funnel_events.filter((r) => r.event === "stripe_payment_failed");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].session_id, SID); assert.equal(rows[0].dedupe_key, "evt_1");
    assert.equal(rows[0].country, "IN"); assert.equal(rows[0].device, "mobile");
    assert.equal((rows[0].detail as Row).card_country, "IN");
    // a second, different failure on the same checkout is a new event id and is kept
    await recordStripeCheckoutEvent(db.client, { event: "stripe_payment_failed", stripeEventId: "evt_2", checkoutSessionId: CS, detail: { ...detail, decline_code: "insufficient_funds" } });
    assert.equal(db.tables.funnel_events.filter((r) => r.event === "stripe_payment_failed").length, 2);
  }
  // reservation / origin not found: the event is still recorded (unlinked), nothing throws
  {
    const db = fakeSupabase();
    assert.equal(await recordStripeCheckoutEvent(db.client, { event: "stripe_payment_failed", stripeEventId: "evt_9", checkoutSessionId: null, detail: { code: "card_declined" } }), true);
    assert.equal(db.tables.funnel_events[0].session_id, null);
    assert.equal(await noteReservationFailure(db.client, "cs_live_missing000000", "card_declined"), false, "no such reservation: quiet false");
    assert.equal(await recordStripeCheckoutEvent(db.client, { event: "stripe_session_expired", stripeEventId: "evt_10", checkoutSessionId: CS, detail: {} }), true, "origin missing: still recorded");
  }
  // paid wins: a failure that arrives after payment (out of order / replay) never touches a paid reservation
  {
    const db = fakeSupabase();
    db.tables.reservations.push({ id: "r1", stripe_checkout_session_id: CS, status: "paid" }, { id: "r2", stripe_checkout_session_id: CS2, status: "pending" });
    assert.equal(await noteReservationFailure(db.client, CS, "card_declined"), false);
    assert.equal(db.tables.reservations[0].last_payment_error, undefined);
    assert.equal(db.tables.reservations[0].status, "paid");
    assert.equal(await noteReservationFailure(db.client, CS2, "card_declined / do_not_honor"), true);
    assert.equal(db.tables.reservations[1].last_payment_error, "card_declined / do_not_honor");
    assert.equal(db.tables.reservations[1].status, "pending", "only the note changes, never the status");
    db.tables.reservations[1].status = "expired";
    assert.equal(await noteReservationFailure(db.client, CS2, "expired_card"), true, "expired-before-failure ordering still records");
    db.tables.reservations[1].status = "refunded";
    assert.equal(await noteReservationFailure(db.client, CS2, "x"), false);
  }
  // migration not applied: detail/traffic columns missing -> falls back, row still lands
  {
    const db = fakeSupabase(["detail", "device", "country"]);
    assert.equal(await recordFunnelEvent(db.client, { event: "stripe_payment_failed", dedupeKey: "evt_3", detail: { code: "c" }, traffic: { device: "mobile" } }), true);
    assert.equal("detail" in db.tables.funnel_events[0], false);
    assert.equal(await recordFunnelEvent(db.client, { event: "checkout_created", dedupeKey: `checkout_created:${CS}`, traffic: { device: "mobile", country: "IN" } }), true);
    assert.equal("device" in db.tables.funnel_events[1], false);
  }
  // browser double fire / beacon + fetch fallback / spam: one row per key; every call reports success
  {
    const db = fakeSupabase();
    const send = () => insertClientFunnelEvent(db.client, { event: "payment_submit", sessionId: SID, dedupeKey: clientDedupeKey("payment_submit", CS, {}), detail: { checkout_id: CS }, traffic: { device: "mobile", country: "IN" } });
    const results = await Promise.all([send(), send(), send()]);
    assert.ok(results.every((r) => r.ok));
    assert.equal(db.tables.funnel_events.length, 1);
    assert.equal(db.tables.funnel_events[0].country, "IN");
  }
  // paid copies device + country from the checkout, and is idempotent
  {
    const db = fakeSupabase();
    await recordFunnelEvent(db.client, { event: "checkout_created", sessionId: SID, traffic: { device: "desktop", country: "AU" }, dedupeKey: `checkout_created:${CS}` });
    assert.equal(await recordPaidEvent(db.client, CS), true);
    assert.equal(await recordPaidEvent(db.client, CS), false);
    const paid = db.tables.funnel_events.find((r) => r.event === "paid")!;
    assert.equal(paid.country, "AU"); assert.equal(paid.session_id, SID);
  }

  checkReport();
  checkForensics();
  console.log("check-checkout-events: ok");
}

// ---------- the admin report ----------
function checkReport() {
  const now = new Date("2026-11-20T12:00:00Z");
  const at = (min: number) => new Date(now.getTime() - 3 * 86_400_000 + min * 60_000).toISOString();
  const ev = (event: string, min: number, over: Partial<CheckoutEventRow> = {}): CheckoutEventRow => ({ created_at: at(min), event, session_id: SID, dedupe_key: null, device: "mobile", country: "IN", detail: null, ...over });
  const created = (cs: string, min: number, over: Partial<CheckoutEventRow> = {}) => ev("checkout_created", min, { dedupe_key: `checkout_created:${cs}`, ...over });
  const res = (cs: string, status: string, over: Partial<ReservationRow> = {}): ReservationRow => ({ created_at: at(0), email: `buyer${cs.slice(-4).toLowerCase()}@yahoo.in`, status, paid_at: status === "paid" ? at(9) : null, stripe_checkout_session_id: cs, variant: "noswipe", utm_campaign: null, ...over });
  const sid = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-00000000000${n}`;
  const fail = (cs: string, min: number, id: string, d: Record<string, unknown>, session: string | null) => ev("stripe_payment_failed", min, { session_id: session, dedupe_key: id, detail: { checkout_id: cs, ...d } });
  const client = (event: string, cs: string, min: number, session: string, d: Record<string, unknown> = {}) => ev(event, min, { session_id: session, dedupe_key: `${event}:${cs}`, detail: { checkout_id: cs, ...d } });

  const A = "cs_live_AAAAAAAAAAAA", B = "cs_live_BBBBBBBBBBBB", C = "cs_live_CCCCCCCCCCCC", D = "cs_live_DDDDDDDDDDDD", E = "cs_live_EEEEEEEEEEEE", F = "cs_live_FFFFFFFFFFFF";
  const events: CheckoutEventRow[] = [
    // A: Indian card declined, then paid on the second try: paid must win, the failure shows as recovered
    created(A, 0, { session_id: sid(1) }), client("checkout_form_ready", A, 1, sid(1)), client("payment_submit", A, 2, sid(1)),
    fail(A, 3, "evt_a1", { code: "card_declined", decline_code: "do_not_honor", card_country: "IN" }, sid(1)),
    ev("paid", 9, { session_id: sid(1), dedupe_key: `paid:${A}` }),
    // B: declined twice, never paid, no browser events (ad blocker): failed, steps still monotonic
    created(B, 0, { session_id: sid(2), country: "GB", device: "desktop" }),
    fail(B, 4, "evt_b1", { code: "card_declined", decline_code: "do_not_honor", card_country: "IN" }, sid(2)),
    fail(B, 5, "evt_b2", { code: "card_declined", decline_code: "insufficient_funds", card_country: "IN" }, sid(2)),
    // C: opened, form ready, left the page
    created(C, 0, { session_id: sid(3), country: "AU", device: "desktop" }), client("checkout_form_ready", C, 1, sid(3)), client("checkout_closed", C, 3, sid(3), { reason: "hidden", seconds: 40 }),
    // D: opened, expired
    created(D, 0, { session_id: sid(4), country: "IN" }), ev("stripe_session_expired", 60, { session_id: sid(4), dedupe_key: "evt_d1", detail: { checkout_id: D } }),
    // E: browser-only error (Stripe.js did not load)
    created(E, 0, { session_id: sid(5), country: "IN" }), client("checkout_form_error", E, 1, sid(5), { code: "stripe_js_unavailable" }),
    // F: paid with no events at all except the reservation (paid before tracking shipped, or all events blocked)
    // excluded: probe session, bot, Stripe test (and its webhook rows), test-local email, example.test, Integration test, older than 30 d
    created("cs_live_PROBEPROBE01", 0, { session_id: "00000000-1111-4000-8000-000000000009" }),
    created("cs_live_BOTBOTBOT001", 0, { session_id: sid(6), device: "bot" }),
    created("cs_test_TESTTESTTEST1", 0, { session_id: sid(7) }), fail("cs_test_TESTTESTTEST1", 1, "evt_t1", { code: "card_declined" }, sid(7)),
    ev("stripe_payment_failed", 2, { session_id: null, dedupe_key: "evt_t2", device: null, country: null, detail: { code: "card_declined", test: true } }),
    created("cs_live_QATESTUSER01", 0, { session_id: sid(8) }), created("cs_live_EXAMPLE00001", 0, { session_id: sid(9) }), created("cs_live_INTEGR000001", 0, { session_id: sid(1).replace(/^1/, "2") }),
    ev("checkout_created", -40 * 24 * 60, { dedupe_key: "checkout_created:cs_live_OLDOLDOLD001", session_id: "44444444-0000-4000-8000-000000000003" }),
    // a failure Stripe sent that could not be tied to a checkout session
    ev("stripe_payment_failed", 6, { session_id: null, dedupe_key: "evt_u1", device: null, country: null, detail: { code: "card_declined", decline_code: "generic_decline", card_country: "US" } })
  ];
  const reservations = [
    res(A, "paid"), res(B, "pending"), res(C, "pending"), res(D, "expired"), res(E, "pending"), res(F, "paid"),
    res("cs_live_PROBEPROBE01", "pending"), res("cs_live_BOTBOTBOT001", "pending"), res("cs_test_TESTTESTTEST1", "pending"),
    res("cs_live_QATESTUSER01", "paid", { email: "qa-test@yahoo.in" }), res("cs_live_EXAMPLE00001", "pending", { email: "x@example.test" }),
    { ...res("cs_live_INTEGR000001", "pending"), city: "Integration test" }
  ];
  const r = computeCheckoutReport(events, reservations, now, 30);

  assert.deepEqual(r.steps.map((s) => [s.key, s.count]), [["opened", 6], ["ready", 4], ["submitted", 3], ["paid", 2]], "A-F only; every excluded kind is gone");
  assert.equal(r.steps[3].pctOfOpened, 33.3);
  assert.equal(r.steps[2].pctOfPrevious, 75);
  assert.deepEqual(r.outcomes, { paid: 2, failed: 2, expired: 1, left: 1, open: 0 }, "paid beats the earlier failure on A");
  assert.deepEqual(r.failures.map((f) => [f.source, f.reason, f.attempts, f.checkouts, f.recovered]), [
    ["stripe", "card_declined / do_not_honor", 2, 2, 1],
    ["stripe", "card_declined / generic_decline", 1, 1, 0],
    ["stripe", "card_declined / insufficient_funds", 1, 1, 0],
    ["browser", "load: stripe_js_unavailable", 1, 1, 0]
  ]);
  assert.deepEqual(r.byCountry.map((c) => [c.key, c.opened, c.paid, c.failed]), [["IN", 3, 1, 1], ["AU", 1, 0, 0], ["GB", 1, 0, 1], ["unknown", 1, 1, 0]]);
  assert.deepEqual(r.byDevice.find((d) => d.key === "desktop"), { key: "desktop", opened: 2, ready: 2, submitted: 1, paid: 0, failed: 1 });
  assert.deepEqual(r.failedCardCountries, [{ key: "IN", attempts: 3 }, { key: "US", attempts: 1 }]);
  assert.equal(r.paidWithoutBrowserEvents, 1, "F: paid, browser never reported");
  assert.equal(r.unlinkedFailures, 1);
  assert.ok(r.excluded.bots >= 1 && r.excluded.internal >= 1 && r.excluded.stripeTest >= 1);

  // a report over nothing is empty, not an error
  const empty = computeCheckoutReport([], [], now, 30);
  assert.deepEqual(empty.steps.map((s) => s.count), [0, 0, 0, 0]);
  assert.equal(empty.steps[1].pctOfOpened, null);
}

// ---------- scripts/checkout-forensics.mjs ----------
function checkForensics() {
  const t = 1_760_000_000;
  const declined = summarizeSession({ id: "cs_live_abcdefgh12345678", created: t, livemode: true, status: "open", payment_status: "unpaid", customer_email: "someone@example.com",
    payment_intent: { status: "requires_payment_method", last_payment_error: { type: "card_error", code: "card_declined", decline_code: "do_not_honor", payment_method: { type: "card", card: { brand: "mastercard", country: "IN", funding: "credit", last4: "0004" } } } } });
  assert.equal(declined.session, "…12345678");
  assert.equal(declined.card_country, "IN");
  assert.ok(!JSON.stringify(declined).includes("someone@") && !JSON.stringify(declined).includes("0004"), "no email or card digits in the output");
  assert.equal(outcomeOf(declined), "failed");
  const paid = summarizeSession({ id: "cs_live_p", created: t, livemode: true, status: "complete", payment_status: "paid", payment_intent: { status: "succeeded", last_payment_error: { code: "card_declined" } } });
  assert.equal(outcomeOf(paid), "paid", "paid wins over an earlier error");
  const expired = summarizeSession({ id: "cs_live_e", created: t, livemode: true, status: "expired", payment_status: "unpaid", payment_intent: null });
  assert.equal(outcomeOf(expired), "expired");
  assert.equal(outcomeOf(summarizeSession({ id: "cs_live_o", created: t, status: "open", payment_status: "unpaid" })), "abandoned");
  assert.deepEqual(aggregate([declined, paid, expired]), { total: 3, outcomes: { failed: 1, paid: 1, expired: 1 }, reasons: { "card_declined / do_not_honor": 1 }, cardCountries: { IN: 1 } });
}

main().catch((error) => { console.error(error); process.exit(1); });
