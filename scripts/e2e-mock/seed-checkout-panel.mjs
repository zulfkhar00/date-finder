// SYNTHETIC data for the local mock Supabase only (scripts/e2e-mock/mock-services.mjs): 15 invented
// live-mode checkouts shaped like the real drop-off (mostly mobile, mostly India, one payment), so the
// admin Checkout panel has something to show in screenshots. Not real users, not prod; it refuses to
// run against anything but the mock.
//
//   node scripts/e2e-mock/seed-checkout-panel.mjs
import crypto from "node:crypto";

const MOCK = process.env.MOCK_ORIGIN || "http://127.0.0.1:54399";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(MOCK)) { console.error("mock only"); process.exit(2); }

const now = Date.now();
const iso = (daysAgo, minutes = 0) => new Date(now - daysAgo * 86_400_000 + minutes * 60_000).toISOString();
const post = async (table, rows) => {
  const r = await fetch(`${MOCK}/rest/v1/${table}`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal", apikey: "mock-service-key", Authorization: "Bearer mock-service-key" }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
};
const id = () => `cs_live_${crypto.randomBytes(12).toString("hex")}`;

// [country, device, how it ended, failure (code/decline/card country) or null, days ago]
const plan = [
  ["IN", "mobile", "failed", ["card_declined", "do_not_honor", "IN"], 2],
  ["IN", "mobile", "failed", ["card_declined", "do_not_honor", "IN"], 3],
  ["IN", "mobile", "failed", ["card_declined", "generic_decline", "IN"], 5],
  ["IN", "mobile", "failed-then-left", ["card_declined", "do_not_honor", "IN"], 6],
  ["IN", "mobile", "left", null, 8],
  ["IN", "desktop", "expired", null, 9],
  ["AU", "mobile", "left", null, 11],
  ["AU", "desktop", "ready-only", null, 12],
  ["GB", "mobile", "failed", ["incorrect_cvc", null, "GB"], 13],
  ["GB", "desktop", "expired", null, 15],
  ["US", "desktop", "paid", null, 17],
  ["US", "mobile", "left", null, 19],
  ["US", "mobile", "paid-after-failure", ["card_declined", "insufficient_funds", "US"], 21],
  [null, "mobile", "no-signal", null, 24],
  ["IN", "mobile", "form-error", null, 26]
];

const reservations = [], events = [];
plan.forEach(([country, device, outcome, failure, daysAgo], n) => {
  const cs = id(), sid = crypto.randomUUID(), t = (m) => iso(daysAgo, m);
  const ev = (event, m, extra = {}) => events.push({ id: crypto.randomUUID(), event, session_id: sid, created_at: t(m), device, country, ...extra });
  const client = (event, m, detail = {}) => ev(event, m, { dedupe_key: `${event}:${cs}`, detail: { checkout_id: cs, ...detail } });
  const paid = outcome.startsWith("paid");
  reservations.push({ id: crypto.randomUUID(), created_at: t(0), email: `synthetic${n}@mailbox.example`.replace(".example", ".org"), city: "Synthetic City", dating_preference: "women", relationship_goal: "committed", date_frequency: "weekly", age_confirmed_at: t(0), terms_accepted_at: t(0), stripe_checkout_session_id: cs, status: paid ? "paid" : outcome === "expired" ? "expired" : "pending", queue_position: paid ? n + 1 : null, paid_at: paid ? t(6) : null, variant: "noswipe" });
  ev("checkout_created", 0, { dedupe_key: `checkout_created:${cs}` });
  if (outcome !== "no-signal" && outcome !== "form-error") client("checkout_form_ready", 0.2);
  if (outcome === "form-error") client("checkout_form_error", 0.2, { code: "stripe_js_unavailable", type: "load" });
  if (failure || paid) client("payment_submit", 1, { payment_method: "card" });
  if (failure) ev("stripe_payment_failed", 1.5, { dedupe_key: `evt_${crypto.randomBytes(8).toString("hex")}`, detail: { checkout_id: cs, code: failure[0], ...(failure[1] ? { decline_code: failure[1] } : {}), type: "card_error", payment_method: "card", card_brand: "visa", card_country: failure[2], funding: "debit" } });
  if (paid) ev("paid", 6, { dedupe_key: `paid:${cs}` });
  if (outcome === "left" || outcome === "failed-then-left") client("checkout_closed", 3, { reason: "hidden", seconds: 41 });
  if (outcome === "expired") ev("stripe_session_expired", 24 * 60, { dedupe_key: `evt_${crypto.randomBytes(8).toString("hex")}`, detail: { checkout_id: cs, seconds: 86400 } });
});
await post("reservations", reservations);
await post("funnel_events", events);
console.log(`seeded ${reservations.length} synthetic checkouts, ${events.length} events into ${MOCK}`);
