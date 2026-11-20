// Paid-country gate: the list parser, the decision (missing header, lowercase, VPN vs billing), the webhook review
// (never a refund, idempotent, billing wins), the schema file and the wiring. No network, no database, no Stripe.
// Run with: node --conditions=react-server --import tsx scripts/check-paid-country.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewPaidCountry } from "../src/lib/country-review";
import { COUNTRY_BLOCKED_CODE, COUNTRY_BLOCKED_COPY, DEFAULT_PAID_COUNTRIES, decidePaid, geoCountry, isPaidCountry, parsePaidCountries, reviewForPaid } from "../src/lib/paid-countries";
import { clientEventSchema } from "../src/lib/attribution";
import { CHECKOUT_DIAGNOSTIC_EVENTS } from "../src/lib/checkout-events";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const SID = "7b1f3c52-0a4e-4f6b-9c3d-2e8a1d5b6f70";
const CS = "cs_test_a1B2c3D4e5F6g7H8";
const RES = "0b9d6a54-3c1e-4d8a-9b57-1f2e3d4c5b6a";

// ---------- the list ----------
assert.deepEqual([...DEFAULT_PAID_COUNTRIES], ["US", "CA", "GB", "AU", "NZ"]);
assert.deepEqual([...parsePaidCountries(undefined)], ["US", "CA", "GB", "AU", "NZ"], "unset = default");
assert.deepEqual([...parsePaidCountries("")], ["US", "CA", "GB", "AU", "NZ"], "empty = default, never worldwide");
assert.deepEqual([...parsePaidCountries("de, fr ,DE")], ["DE", "FR"], "env override: any case, spaces, duplicates");
assert.deepEqual([...parsePaidCountries("us;ca gb")], ["US", "CA", "GB"], "commas, semicolons and spaces all separate");
assert.deepEqual([...parsePaidCountries("usa, 12, *")], ["US", "CA", "GB", "AU", "NZ"], "nothing valid left = default, a typo cannot open the service everywhere");

assert.equal(isPaidCountry("us"), true, "lowercase code");
assert.equal(isPaidCountry(" gb "), true, "padded code");
assert.equal(isPaidCountry("NZ"), true);
assert.equal(isPaidCountry("DE"), false);
assert.equal(isPaidCountry(""), false);
assert.equal(isPaidCountry(null), false);
assert.equal(isPaidCountry("USA"), false);
assert.equal(isPaidCountry("DE", ["DE"]), true, "explicit list");

// ---------- geo header ----------
assert.equal(geoCountry(h({ "x-vercel-ip-country": "us" })), "US", "lowercase header");
assert.equal(geoCountry(h({})), null, "missing header");
assert.equal(geoCountry(h({ "x-vercel-ip-country": "XX" })), null, "XX = unknown");
assert.equal(geoCountry(h({ "x-vercel-ip-country": "T1" })), null, "T1 = Tor");
assert.equal(geoCountry(h({ "x-vercel-ip-country": "DE", "cf-ipcountry": "US" })), "DE", "Vercel's header wins: a client-sent cf-ipcountry cannot open the gate");
assert.equal(geoCountry(h({ "cf-ipcountry": "gb" })), "GB", "Cloudflare fallback");

// ---------- decision ----------
const prod = (country: string | null, extra: object = {}) => decidePaid({ country, production: true, ...extra });
assert.equal(prod("US").allowed, true);
assert.equal(prod("us".toUpperCase()).reason, "listed");
assert.equal(prod("DE").allowed, false);
assert.equal(prod("DE").reason, "unsupported");
assert.equal(prod(null).allowed, false, "production: missing geo header refuses");
assert.equal(prod(null).reason, "no_geo");
assert.equal(decidePaid({ country: null, production: false }).allowed, true, "outside production a missing header is allowed (local dev)");
assert.equal(decidePaid({ country: "DE", production: false }).allowed, false, "outside production a known unsupported country is still refused");
assert.equal(prod("DE", { override: true }).allowed, true, "admin override passes");
assert.equal(prod(null, { override: true }).reason, "override");
assert.equal(prod("DE", { list: ["DE"] }).allowed, true, "env list applies");

// ---------- webhook review: billing country is the truth ----------
assert.equal(reviewForPaid({ billing: "US", geo: "DE" }), null, "VPN: IP outside the list but billing country inside = fine");
assert.equal(reviewForPaid({ billing: "de", geo: "US" }), "billing_country_outside_list", "billing outside the list is flagged even if the IP looked fine (lowercase ok)");
assert.equal(reviewForPaid({ billing: null, geo: "DE" }), "geo_country_outside_list", "no billing country (session opened before the gate): fall back to the IP country");
assert.equal(reviewForPaid({ billing: undefined, geo: "gb" }), null);
assert.equal(reviewForPaid({ billing: null, geo: null }), "country_unknown", "nothing known: a person decides");
assert.equal(reviewForPaid({ billing: "USA", geo: "US" }), null, "a malformed billing value is ignored, the IP country decides");

// A tiny in-memory Supabase: just the calls the review makes.
type Row = Record<string, unknown>;
function fakeSupabase(opts: { origin?: Row | null; reservationStatus?: string; failColumn?: boolean } = {}) {
  const funnel: Row[] = [];
  const reservation: Row = { id: RES, status: opts.reservationStatus ?? "paid" };
  const chain = (table: string) => {
    const state: { op?: string; payload?: Row; filters: [string, unknown][] } = { filters: [] };
    const api: Record<string, unknown> = {};
    const run = () => {
      if (table === "reservations" && state.op === "update") {
        if (opts.failColumn) return { data: null, error: { code: "42703" } };
        const matches = state.filters.every(([k, v]) => reservation[k] === v);
        if (matches) Object.assign(reservation, state.payload);
        return { data: matches ? [{ id: RES }] : [], error: null };
      }
      if (table === "funnel_events" && state.op === "upsert") {
        const key = state.payload?.dedupe_key;
        const dup = funnel.some((r) => r.dedupe_key === key);
        if (!dup) funnel.push(state.payload!);
        return { data: dup ? [] : [{ id: funnel.length }], error: null };
      }
      if (table === "funnel_events" && state.op === "select") return { data: opts.origin ?? null, error: null };
      return { data: null, error: null };
    };
    for (const m of ["select", "update", "upsert"]) api[m] = (a?: unknown) => { if (m !== "select" || !state.op) state.op = m; if (m !== "select") state.payload = a as Row; return api; };
    api.eq = (k: string, v: unknown) => { state.filters.push([k, v]); return api; };
    api.maybeSingle = async () => run();
    api.then = (resolve: (v: unknown) => unknown) => resolve(run());
    return api;
  };
  return { sb: { from: chain } as never, funnel, reservation };
}

async function main() {
  // US billing: nothing marked, no event.
  const ok = fakeSupabase();
  const fine = await reviewPaidCountry(ok.sb, RES, { id: CS, customer_details: { address: { country: "US" } } });
  assert.deepEqual(fine, { review: null, billing: "US", marked: false });
  assert.equal(ok.reservation.country_review, undefined);
  assert.equal(ok.funnel.length, 0);

  // DE billing: marked for review, one funnel event, status untouched (never refunded, never un-paid).
  const bad = fakeSupabase();
  const flagged = await reviewPaidCountry(bad.sb, RES, { id: CS, customer_details: { address: { country: "de" } } });
  assert.equal(flagged.review, "billing_country_outside_list");
  assert.equal(flagged.marked, true);
  assert.equal(bad.reservation.country_review, "billing_country_outside_list");
  assert.equal(bad.reservation.billing_country, "DE");
  assert.equal(bad.reservation.status, "paid", "the reservation stays paid: review, never auto-refund");
  assert.equal(bad.funnel.length, 1);
  assert.equal(bad.funnel[0].event, "paid_country_review");
  assert.deepEqual(bad.funnel[0].detail, { checkout_id: CS, reason: "billing_country_outside_list", billing_country: "DE" });
  assert.doesNotMatch(JSON.stringify(bad.funnel), /@|street|line1|postal/i, "no address or email in the event");

  // Webhook retry: same event again does not add a second funnel row.
  await reviewPaidCountry(bad.sb, RES, { id: CS, customer_details: { address: { country: "DE" } } });
  assert.equal(bad.funnel.length, 1, "retries are idempotent");

  // An existing pending reservation from another country that pays later: no billing country on its (old) session, geo from checkout_created.
  const old = fakeSupabase({ origin: { session_id: SID, variant: "noswipe", utm_campaign: null, ref: null, device: "mobile", country: "BR" } });
  const legacy = await reviewPaidCountry(old.sb, RES, { id: CS, customer_details: null });
  assert.equal(legacy.review, "geo_country_outside_list");
  assert.equal(old.reservation.country_review, "geo_country_outside_list");
  assert.equal(old.reservation.billing_country, null);

  // A reservation that is not paid is never marked (the update is guarded on status = paid).
  const pending = fakeSupabase({ reservationStatus: "pending" });
  const skipped = await reviewPaidCountry(pending.sb, RES, { id: CS, customer_details: { address: { country: "DE" } } });
  assert.equal(skipped.marked, false);

  // Column missing (migration not applied): never throws, payment still counts.
  const early = fakeSupabase({ failColumn: true });
  const survived = await reviewPaidCountry(early.sb, RES, { id: CS, customer_details: { address: { country: "DE" } } });
  assert.equal(survived.review, "billing_country_outside_list");
  assert.equal(survived.marked, false);

  // ---------- events ----------
  const blocked = clientEventSchema.safeParse({ sessionId: SID, event: "checkout_blocked_country" });
  assert.equal(blocked.success, true, "the browser may send checkout_blocked_country without a checkout id");
  assert.equal(clientEventSchema.safeParse({ sessionId: SID, event: "paid_country_review" }).success, false, "paid_country_review is server-only");
  assert.ok(CHECKOUT_DIAGNOSTIC_EVENTS.has("checkout_blocked_country") && CHECKOUT_DIAGNOSTIC_EVENTS.has("paid_country_review"), "neither counts as funnel progress");

  // ---------- schema file ----------
  const forensics = read("../supabase/2026-11-20-checkout-forensics.sql");
  const sql = read("../supabase/2026-11-20-paid-country-gate.sql");
  const names = (text: string) => [...(text.match(/funnel_events_event_check\s+check \(event in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  const before = names(forensics);
  const after = names(sql);
  assert.ok(before.length > 20, "parsed the current list");
  for (const name of before) assert.ok(after.includes(name), `keeps ${name}`);
  assert.deepEqual(after.filter((n) => !before.includes(n)), ["checkout_blocked_country", "paid_country_review"], "adds exactly the two new events");
  assert.match(sql, /add column if not exists country_review text/);
  assert.match(sql, /add column if not exists billing_country text/);
  assert.match(sql, /alter table public\.reservations enable row level security/);
  assert.match(sql, /revoke all on public\.reservations from public, anon, authenticated/);
  assert.doesNotMatch(sql, /drop table|drop column|delete from|truncate/i, "additive only");
  assert.doesNotMatch(sql, /^\s*(create table|alter table[^;]*add column)(?![^;]*if not exists)/im, "every add is idempotent");

  // ---------- wiring ----------
  const checkout = read("../src/app/api/checkout/route.ts");
  assert.match(checkout, /paidAccessFor\(request\.headers\)/, "checkout asks the gate");
  assert.match(checkout, /status: 403/);
  assert.match(checkout, /COUNTRY_BLOCKED_CODE/);
  assert.ok(checkout.indexOf("await paidAccessFor") < checkout.indexOf("await reuseOpenCheckout"), "the gate runs before an open session is handed back");
  assert.ok(checkout.indexOf("await paidAccessFor") < checkout.indexOf(".insert(rows[0])"), "and before a reservation is created");
  assert.match(checkout, /billing_address_collection: "required"/, "Stripe collects the billing address");
  assert.equal(COUNTRY_BLOCKED_CODE, "country_not_supported");
  const webhook = read("../src/app/api/stripe/webhook/route.ts");
  assert.match(webhook, /reviewPaidCountry\(supabase, id\.data, session\)/);
  assert.doesNotMatch(webhook, /refunds\.create/, "the webhook never refunds by itself");
  const access = read("../src/lib/paid-access.ts");
  assert.match(access, /isAdminEmail\(config, user\.email\)/, "admin override uses ADMIN_EMAILS");
  assert.match(access, /getAppUser/, "from the confirmed app session");

  // UI: blocked message, no payment form, in every place checkout is offered.
  assert.equal(COUNTRY_BLOCKED_COPY, "NoSwipe’s paid service isn’t available in your country yet. Your free starter pack still works.");
  const flow = read("../src/app/onboarding/flow.tsx");
  assert.match(flow, /def\.key === "pay" && countryBlocked \? \(\s*<CountryBlocked \/>/, "pay step shows the message");
  assert.match(flow, /res\.status === 403 && result\.code === COUNTRY_BLOCKED_CODE/, "a 403 from the API lands on the same message");
  assert.match(flow, /disabled=\{busy\} aria-busy=\{busy\}/, "checkout button still disables while opening");
  const resume = read("../src/components/app/resume-card.tsx");
  assert.match(resume, /if \(countryBlocked\) return <CountryBlocked/, "the activate card shows the message");
  assert.match(read("../src/components/app/country-blocked.tsx"), /checkout_blocked_country/);
  const onboardingPage = read("../src/app/onboarding/page.tsx");
  assert.match(onboardingPage, /paidAccessFor\(\)/);
  assert.match(onboardingPage, /startStep=\{0\} paid=\{false\} paidOffered=\{paidOffered\}/, "guests get the gate too, sign-up itself is untouched");

  // Copy.
  const five = /United States, Canada, the United Kingdom, Australia and New Zealand/;
  assert.match(read("../src/app/pricing/page.tsx"), five);
  assert.match(read("../src/app/terms/page.tsx"), five);
  assert.match(read("../src/content/ai-pages-concierge.ts"), five);
  assert.match(read("../src/content/ai-pages-concierge.ts"), /free tools[^"]*work anywhere/i);
  assert.doesNotMatch(read("../src/lib/llms.ts"), /online and global/);
  console.log("paid country checks ok");
}
void main();
