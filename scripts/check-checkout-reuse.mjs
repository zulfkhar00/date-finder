import assert from "node:assert/strict";
import { reuseOpenCheckout, REUSE_WINDOW_MS } from "../src/lib/checkout-reuse.ts";
import { onboardingSchema, reservationSchema } from "../src/lib/reservation.ts";

// Retry safety: same open session is reused, expired ones are retired, paid ones are never re-sold.
function deps(rows, sessions, log = []) {
  return {
    findPending: async () => rows,
    retrieve: async (id) => { if (!sessions[id]) throw new Error("network"); return sessions[id]; },
    markExpired: async (id) => { log.push(id); },
    respond: (s) => { if (!s.client_secret) throw new Error("no secret"); return { sessionId: s.id }; }
  };
}
const row = (id, session) => ({ id, stripe_checkout_session_id: session, created_at: new Date().toISOString() });

let log = [];
let r = await reuseOpenCheckout(deps([row("r1", "cs_test_a")], { cs_test_a: { id: "cs_test_a", status: "open", client_secret: "x" } }, log), "a@b.co");
assert.deepEqual(r, { kind: "reuse", reservationId: "r1", sessionId: "cs_test_a", response: { sessionId: "cs_test_a" } });

r = await reuseOpenCheckout(deps([row("r1", "cs_test_a"), row("r0", "cs_test_b")], { cs_test_a: { id: "cs_test_a", status: "expired" }, cs_test_b: { id: "cs_test_b", status: "open", client_secret: "y" } }, log), "a@b.co");
assert.equal(r.reservationId, "r0");
assert.deepEqual(log, ["r1"]); // expired one retired, older open one reused

log = [];
r = await reuseOpenCheckout(deps([row("r1", "cs_test_a")], { cs_test_a: { id: "cs_test_a", status: "expired" } }, log), "a@b.co");
assert.equal(r.kind, "new"); // expired session: caller creates a fresh one
assert.deepEqual(log, ["r1"]);

r = await reuseOpenCheckout(deps([row("r1", "cs_test_a")], { cs_test_a: { id: "cs_test_a", status: "complete", payment_status: "paid" } }), "a@b.co");
assert.equal(r.kind, "paid");

log = [];
r = await reuseOpenCheckout(deps([row("r1", "cs_test_a")], {}, log), "a@b.co"); // Stripe unreachable: no guess, no expiry
assert.equal(r.kind, "new");
assert.deepEqual(log, []);

r = await reuseOpenCheckout({ ...deps([], {}), findPending: async () => { throw new Error("db"); } }, "a@b.co");
assert.equal(r.kind, "new");
r = await reuseOpenCheckout(deps([row("r1", null)], {}), "a@b.co");
assert.equal(r.kind, "new");
assert.ok(REUSE_WINDOW_MS < 24 * 3600 * 1000);

// The pay step must work when every optional onboarding question was skipped.
const base = { ageConfirmed: true, email: "A@B.co", datingPreference: "all_genders", relationshipGoal: "meaningful", dateFrequency: "twice_monthly", termsAccepted: true };
assert.equal(reservationSchema.parse({ ...base, city: "" }).city, "Not given");
assert.equal(reservationSchema.parse({ ...base, city: " Leeds " }).city, "Leeds");
assert.equal(onboardingSchema.safeParse({ name: "", apps: [], ageMin: 18, ageMax: 99, interests: "" }).success, true);
assert.equal(onboardingSchema.safeParse({ name: "Al", age: 17, apps: [], ageMin: 18, ageMax: 99, interests: "" }).success, false);
console.log("checkout reuse: same session, expired retry, paid guard and skipped answers passed");
