import assert from "node:assert/strict";
import { buildDigestText } from "../src/lib/digest.ts";
import { funnelRowAttempts } from "../src/lib/funnel.ts";
import { funnelAccount } from "../src/lib/funnel-account.ts";
import { computeRealFunnel, internalSessionIds, type EventRow, type ReservationRow } from "../src/lib/real-funnel.ts";
import { buildTrafficModel } from "../src/lib/traffic-report.ts";
import { computeSignups, recordFirstConfirmation, type SignupEventRow } from "../src/lib/signups.ts";

// Local fixtures only: no network, no Supabase, no Telegram (the digest route is driven below with a
// fake PostgREST behind globalThis.fetch and a captured Telegram call).

const NOW = Date.UTC(2026, 10, 21, 17, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const U_EXT = "11111111-1111-4111-8111-111111111111";
const U_EXT2 = "22222222-2222-4222-8222-222222222222";
const U_FOUNDER = "33333333-3333-4333-8333-333333333333";
const U_FLAGGED = "44444444-4444-4444-8444-444444444444"; // profiles.internal = true, email looked external when the event was written

// ---- funnelAccount: id + internal flag from the email, never stores the email ----
assert.deepEqual(funnelAccount(U_EXT, "real.person@gmail.com"), { userId: U_EXT, internal: false });
assert.deepEqual(funnelAccount(U_FOUNDER, "meyrlansuirkhanov+test1@gmail.com"), { userId: U_FOUNDER, internal: true }, "founder alias");
assert.deepEqual(funnelAccount(U_EXT, "smoke-run@example.test"), { userId: U_EXT, internal: true }, "test address");
assert.equal(funnelAccount("not-a-uuid", "a@b.com"), null);
assert.equal(funnelAccount(null, "a@b.com"), null);
assert.equal(JSON.stringify(funnelAccount(U_EXT, "real.person@gmail.com")).includes("@"), false);

// ---- insert shapes: account link dropped first when its migration is absent ----
const shapes = funnelRowAttempts({ event: "page_view", sessionId: "s", account: { userId: U_EXT, internal: false } });
assert.equal(shapes[0].user_id, U_EXT);
assert.equal(shapes[0].account_internal, false);
assert.ok(shapes.slice(1).every((row) => !("user_id" in row)), "fallback shapes carry no account");
assert.ok(funnelRowAttempts({ event: "page_view", sessionId: "s" }).every((row) => !("user_id" in row)), "guests never get account columns");

// ---- computeSignups: first confirmations, external only ----
const row = (user_id: string | null, at: number, account_internal: boolean | null = false): SignupEventRow => ({ created_at: iso(at), user_id, account_internal });
const rows: SignupEventRow[] = [
  row(U_EXT, NOW - 2 * 60 * 60 * 1000),            // 2h ago: counts in 24h and 30d
  row(U_EXT, NOW - 60 * 60 * 1000),                // the same account again (repeat row): counts once
  row(U_EXT2, NOW - 25 * 60 * 60 * 1000),          // 25h ago: 30d only
  row("55555555-5555-4555-8555-555555555555", NOW - 31 * DAY), // outside both windows
  row(U_FOUNDER, NOW - 60 * 60 * 1000, true),      // internal by the email flag
  row(U_FLAGGED, NOW - 60 * 60 * 1000, false),     // internal by profiles.internal
  row(null, NOW - 60 * 60 * 1000, null),           // no account on the row: never counted
  row("66666666-6666-4666-8666-666666666666", NOW + 60_000) // from the future (clock skew): ignored
];
const stats = computeSignups(rows, new Set([U_FLAGGED]), iso(NOW - 40 * DAY), new Date(NOW));
assert.deepEqual({ day: stats.day, month: stats.month, excluded: stats.excludedInternal30d }, { day: 1, month: 2, excluded: 2 });
assert.deepEqual(computeSignups([], new Set(), null, new Date(NOW)).month, 0);

// ---- recordFirstConfirmation: first time only, never the email, never throws ----
type Call = { table: string; op: string; payload?: unknown };
function fakeSupabase(opts: { profile: boolean; profileError?: boolean; insertError?: boolean }) {
  const calls: Call[] = [];
  const builder = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => (opts.profileError ? { data: null, error: { code: "XX000" } } : { data: opts.profile ? { user_id: U_EXT } : null, error: null }) }) }),
    insert: async (payload: unknown) => { calls.push({ table, op: "insert", payload }); return { error: opts.insertError ? { code: "XX000" } : null }; },
    upsert: (payload: unknown) => { calls.push({ table, op: "upsert", payload }); return { select: async () => ({ data: [{ id: "x" }], error: null }) }; }
  });
  return { calls, client: { from: builder } as never };
}
{
  const first = fakeSupabase({ profile: false });
  await recordFirstConfirmation({ id: U_EXT, email: "real.person@gmail.com" }, first.client);
  assert.equal(first.calls.length, 1);
  const written = first.calls[0].payload as Record<string, unknown>;
  assert.equal(written.event, "signup_confirmed");
  assert.equal(written.dedupe_key, `signup:${U_EXT}`);
  assert.equal(written.user_id, U_EXT);
  assert.equal(written.account_internal, false);
  assert.equal(JSON.stringify(written).includes("@"), false, "no email in the row");
  const founder = fakeSupabase({ profile: false });
  await recordFirstConfirmation({ id: U_FOUNDER, email: "olxzulfar@gmail.com" }, founder.client);
  assert.equal((founder.calls[0].payload as Record<string, unknown>).account_internal, true);
  const repeat = fakeSupabase({ profile: true });
  await recordFirstConfirmation({ id: U_EXT, email: "real.person@gmail.com" }, repeat.client);
  assert.equal(repeat.calls.length, 0, "repeat login (profile exists) records nothing");
  const unknown = fakeSupabase({ profile: false, profileError: true });
  await recordFirstConfirmation({ id: U_EXT, email: "real.person@gmail.com" }, unknown.client);
  assert.equal(unknown.calls.length, 0, "unknown history records nothing");
  const broken = fakeSupabase({ profile: false, insertError: true });
  await recordFirstConfirmation({ id: U_EXT, email: "real.person@gmail.com" }, broken.client); // must not throw
}

// ---- funnel: internal signed-in sessions abandoned before checkout ----
const ev = (session_id: string | null, event: string, at: number, extra: Partial<EventRow> = {}): EventRow =>
  ({ created_at: iso(at), event, session_id, variant: "noswipe", utm_campaign: "reel-a", dedupe_key: null, ...extra });
const EXT = "ext-session-1", EXT_GUEST = "ext-guest-2", FOUNDER_S = "founder-abandoned", FLAGGED_S = "flagged-abandoned",
  GUEST_THEN_FOUNDER = "guest-then-founder", LEGACY = "legacy-no-link", PROBE = "00000000-aaaa-4aaa-8aaa-000000000000", TEST_CHECKOUT = "stripe-test-checkout";
const t = NOW - 3 * 60 * 60 * 1000;
const events: EventRow[] = [
  // eligible external: signed in, completed onboarding, no checkout yet
  ev(EXT, "page_view", t), ev(EXT, "get_started", t + 1000), ev(EXT, "reserve_start", t + 2000, { user_id: U_EXT, account_internal: false }), ev(EXT, "onboarding_complete", t + 9000, { user_id: U_EXT, account_internal: false }),
  // external guest who only viewed
  ev(EXT_GUEST, "page_view", t),
  // founder signed in, abandoned before checkout
  ev(FOUNDER_S, "page_view", t), ev(FOUNDER_S, "get_started", t + 1000), ev(FOUNDER_S, "reserve_start", t + 2000, { user_id: U_FOUNDER, account_internal: true }), ev(FOUNDER_S, "onboarding_complete", t + 9000, { user_id: U_FOUNDER, account_internal: true }),
  // account flagged internal on its profile only (event row says external)
  ev(FLAGGED_S, "page_view", t), ev(FLAGGED_S, "reserve_start", t + 2000, { user_id: U_FLAGGED, account_internal: false }),
  // guest-to-member: page_view and get_started as a guest, only the later events carry the account
  ev(GUEST_THEN_FOUNDER, "page_view", t), ev(GUEST_THEN_FOUNDER, "get_started", t + 500), ev(GUEST_THEN_FOUNDER, "reserve_start", t + 1000), ev(GUEST_THEN_FOUNDER, "ob_apps", t + 5000, { user_id: U_FOUNDER, account_internal: true }),
  // historical: written before the account link; nothing marks it internal, so it stays counted (documented gap)
  ev(LEGACY, "page_view", t - 5 * DAY), ev(LEGACY, "reserve_start", t - 5 * DAY + 1000),
  // explicit probe marker
  ev(PROBE, "page_view", t), ev(PROBE, "reserve_start", t + 1000),
  // existing Stripe test exclusion still holds
  ev(TEST_CHECKOUT, "page_view", t), ev(TEST_CHECKOUT, "reserve_start", t + 1000), ev(TEST_CHECKOUT, "checkout_created", t + 2000, { dedupe_key: "checkout_created:cs_test_123" })
];
const reservations: ReservationRow[] = [];
const internalUsers = new Set([U_FLAGGED]);
const funnel = computeRealFunnel(events, reservations, 1, new Date(NOW), undefined, { internalUserIds: internalUsers });
assert.equal(funnel.visitors, 2, "only the external signed-in session and the external guest are visitors");
assert.equal(funnel.getStarted, 1);
assert.equal(funnel.reserveStarts, 1);
assert.equal(funnel.onboardingComplete, 1);
assert.equal(funnel.excluded.internalSessions, 5, "founder, flagged, guest-then-founder, probe, stripe-test");
// Without the account link the same founder sessions would count (this is the gap being closed).
const before = computeRealFunnel(events.map((e) => ({ ...e, user_id: undefined, account_internal: undefined })), reservations, 1, new Date(NOW));
assert.equal(before.visitors, 5, "pre-fix behaviour: founder/flagged/guest-then-founder sessions leak in (probe and test checkout were already excluded)");
assert.equal(before.reserveStarts, 4);
// 30-day view includes the historical row, which cannot be classified.
const month = computeRealFunnel(events, reservations, 30, new Date(NOW), undefined, { internalUserIds: internalUsers });
assert.equal(month.visitors, 3, "30d: + the legacy session (unclassifiable, counted)");
// Never inferred from shared fields: sessions with the same variant/campaign/time as an internal one stay as they are.
assert.equal(internalSessionIds(events, new Set(), internalUsers).has(EXT_GUEST), false);
assert.equal(internalSessionIds(events, new Set(), internalUsers).has(EXT), false);
// The admin traffic model uses the same exclusion.
const model = buildTrafficModel(events, reservations, undefined, { internalUserIds: internalUsers });
assert.equal(model.sessions.has(FOUNDER_S), false);
assert.equal(model.sessions.has(FLAGGED_S), false);
assert.equal(model.sessions.has(GUEST_THEN_FOUNDER), false);
assert.equal(model.sessions.has(EXT), true);

// ---- digest text: signups separate from Get started, n/a stays local ----
const text = buildDigestText({ now: new Date(NOW), day: funnel, month, signups: { day: 1, month: 4, captureSince: iso(NOW - 2 * DAY), excludedInternal30d: 3 }, refs: "none" });
assert.match(text, /Get started clicks: 1 \(30d 1\)/);
assert.match(text, /Confirmed signups \(first email confirmation\): 1 \(30d 4\) \(counted since Nov 19\)/);
const partial = buildDigestText({ now: new Date(NOW), day: funnel, month: null, signups: null, refs: null });
assert.match(partial, /Confirmed signups \(first email confirmation\): n\/a$/m);
assert.match(partial, /Page views \(visitors\): 2 \(30d n\/a\)/m, "day funnel still shows when 30d failed");
assert.match(buildDigestText({ now: new Date(NOW), day: null, month: null, signups: { day: 0, month: 0, captureSince: null, excludedInternal30d: 0 }, refs: null }), /not tracked yet/);
assert.match(buildDigestText({ now: new Date(NOW), day: null, month: null, signups: { day: 2, month: 5, captureSince: iso(NOW - 90 * DAY), excludedInternal30d: 0 }, refs: null }), /Confirmed signups \(first email confirmation\): 2 \(30d 5\)$/m, "no partial note once tracking is older than 30d");

// ---- the real digest route against a fake PostgREST and a captured Telegram call ----
process.env.CRON_SECRET = "test-secret";
process.env.SUPABASE_URL = "http://postgrest.local";
process.env.SUPABASE_SECRET_KEY = "mock-key";
process.env.NOSWIPE_OPS_BOT_TOKEN = "mock-token";
process.env.NOSWIPE_OPS_CHAT_ID = "-100mock";

type Db = { funnel_events: Record<string, unknown>[]; reservations: Record<string, unknown>[]; profiles: Record<string, unknown>[] };
const db: Db = { funnel_events: [], reservations: [], profiles: [] };
const failing = new Set<string>(); // "table" or "table:event"
let accountColumns = true;
const telegram: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "api.telegram.org") { telegram.push(JSON.parse(String(init?.body)).text); return new Response("{}", { status: 200 }); }
  assert.equal(url.hostname, "postgrest.local", `unexpected host ${url.hostname}`);
  const table = url.pathname.split("/").pop() as keyof Db;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const eventFilter = url.searchParams.get("event")?.replace("eq.", "");
  if (failing.has(table) || (eventFilter && failing.has(`${table}:${eventFilter}`))) return json(500, { code: "XX000", message: "boom" });
  const select = url.searchParams.get("select") ?? "*";
  if (!accountColumns && /user_id|account_internal/.test(select) && table === "funnel_events") return json(400, { code: "42703", message: "undefined column" });
  let out = db[table].filter((r) => {
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "offset", "limit"].includes(key)) continue;
      if (value.startsWith("eq.") && String(r[key]) !== value.slice(3)) return false;
      if (value.startsWith("gte.") && !(String(r[key]) >= value.slice(4))) return false;
      if (value === "not.is.null" && r[key] == null) return false;
    }
    return true;
  });
  out = [...out].sort((a, b) => String(a.created_at ?? a.user_id).localeCompare(String(b.created_at ?? b.user_id)));
  const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 1000);
  const cols = select === "*" ? null : select.split(",").map((c) => c.trim());
  const project = (r: Record<string, unknown>) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c]])) : r);
  return json(200, out.slice(offset, offset + limit).map(project));
}) as typeof fetch;

let n = 0;
const dbEvent = (session_id: string | null, event: string, at: number, extra: Record<string, unknown> = {}) =>
  db.funnel_events.push({ id: String(++n).padStart(6, "0"), created_at: iso(at), event, session_id, variant: "noswipe", utm_campaign: "reel-a", dedupe_key: null, ...extra });
const realNow = Date.now();
const r0 = realNow - 2 * 60 * 60 * 1000;
dbEvent(EXT, "page_view", r0); dbEvent(EXT, "get_started", r0 + 1000); dbEvent(EXT, "reserve_start", r0 + 2000, { user_id: U_EXT, account_internal: false });
dbEvent(FOUNDER_S, "page_view", r0); dbEvent(FOUNDER_S, "get_started", r0 + 1000); dbEvent(FOUNDER_S, "reserve_start", r0 + 2000, { user_id: U_FOUNDER, account_internal: true });
dbEvent(FLAGGED_S, "page_view", r0); dbEvent(FLAGGED_S, "get_started", r0 + 1000);dbEvent(FLAGGED_S, "reserve_start", r0 + 2000, { user_id: U_FLAGGED, account_internal: false });
dbEvent(null, "signup_confirmed", r0 + 3000, { user_id: U_EXT, account_internal: false, dedupe_key: `signup:${U_EXT}` });
dbEvent(null, "signup_confirmed", r0 + 3000, { user_id: U_EXT2, account_internal: false, dedupe_key: `signup:${U_EXT2}` });
dbEvent(null, "signup_confirmed", r0 + 3000, { user_id: U_FOUNDER, account_internal: true, dedupe_key: `signup:${U_FOUNDER}` });
dbEvent(null, "signup_confirmed", r0 + 3000, { user_id: U_FLAGGED, account_internal: false, dedupe_key: `signup:${U_FLAGGED}` });
dbEvent(null, "signup_confirmed", realNow - 10 * DAY, { user_id: "77777777-7777-4777-8777-777777777777", account_internal: false, dedupe_key: "signup:7" });
db.profiles.push({ user_id: U_FLAGGED, internal: true }, { user_id: U_EXT, internal: false });

const { GET } = await import("../src/app/api/cron/digest/route");
async function digest(): Promise<string> {
  telegram.length = 0;
  const response = await GET(new Request("http://localhost/api/cron/digest?force=1", { headers: { authorization: "Bearer test-secret" } }));
  assert.equal(response.status, 200);
  assert.equal(telegram.length, 1, "exactly one (mock) Telegram message");
  assert.equal(telegram[0].includes("@"), false, "no email in the digest");
  return telegram[0];
}
let msg = await digest();
assert.match(msg, /Page views \(visitors\): 1 \(30d 1\)/);
assert.match(msg, /Get started clicks: 1 \(30d 1\)/, "founder and flagged sessions abandoned before checkout are gone");
assert.match(msg, /Confirmed signups \(first email confirmation\): 2 \(30d 3\)/, "2 external in 24h, 1 more 10 days ago; founder and flagged dropped");
assert.match(msg, /Onboarding opened: 1 \(30d 1\)/);

// signups query dies: only the signups line goes n/a
failing.add("funnel_events:signup_confirmed");
msg = await digest();
assert.match(msg, /Confirmed signups \(first email confirmation\): n\/a/);
assert.match(msg, /Get started clicks: 1 \(30d 1\)/, "unrelated metrics stay available");
failing.clear();

// profiles unreadable: exclusion list incomplete, so funnel AND signups are n/a rather than inflated; refs line unaffected
failing.add("profiles");
msg = await digest();
assert.match(msg, /Get started clicks: n\/a \(30d n\/a\)/);
assert.match(msg, /Confirmed signups \(first email confirmation\): n\/a/);
assert.match(msg, /Paid by ref: none/);
failing.clear();

// reservations unreadable: funnel n/a, signups still fine
failing.add("reservations");
msg = await digest();
assert.match(msg, /Page views \(visitors\): n\/a/);
assert.match(msg, /Confirmed signups \(first email confirmation\): 2 \(30d 3\)/);
failing.clear();

// migration not applied: funnel keeps working on the old shape, signups say n/a (never a made-up 0)
accountColumns = false;
msg = await digest();
assert.match(msg, /Page views \(visitors\): 3 \(30d 3\)/, "falls back to session-only exclusions");
assert.match(msg, /Confirmed signups \(first email confirmation\): n\/a/);
accountColumns = true;

// unauthorized stays unauthorized
assert.equal((await GET(new Request("http://localhost/api/cron/digest?force=1"))).status, 401);
globalThis.fetch = realFetch;

console.log("check-funnel-integrity: ok");
