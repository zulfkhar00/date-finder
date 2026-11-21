// Fulfilment: SLA badges, queue order and filters, the status workflow and its audit log, the client-facing copy for every state,
// the ops alert (paid only, once per client per day, no PII), the cron route's auth and the migration file.
// No network, no database: an in-memory Supabase and a stubbed fetch.
// Run with: node --conditions=react-server --import tsx scripts/check-fulfilment.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_STATUSES, WORKFLOW_STATUSES, canAiSend, effectiveStatus, isActiveStatus, STATUS_LABELS } from "../src/lib/app/domain";
import { RESUME_COPY, RESUME_FORBIDDEN } from "../src/lib/app/resume";
import { appCopy, START_WITHIN_HOURS } from "../src/lib/app/status-copy";
import { alertKey, applyFilters, buildRow, compareQueue, countrySupport, needsAlert, opsLine, parseFilters, parseStatusChange, slaTone, waitingSinceOf, type QueueInput, type QueueRow } from "../src/lib/fulfilment/core";
import { addNoteEvent, changeAppStatus, listEvents, loadQueue, runFulfilmentSweep } from "../src/lib/fulfilment/service";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const H = 3_600_000;
const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * H).toISOString();

// ---------- SLA badge ----------
assert.equal(slaTone(0), "green");
assert.equal(slaTone(23), "green");
assert.equal(slaTone(24), "amber", "24 h is amber");
assert.equal(slaTone(72), "amber", "72 h is still amber: red is OVER 72 h");
assert.equal(slaTone(73), "red");

// ---------- rows ----------
const input = (o: Partial<QueueInput> & { id: string }): QueueInput => ({
  userId: o.id, firstName: "Sam", email: `${o.id}@real.org`, createdAt: ago(200), onboardingDoneAt: ago(30), paid: false, paidAt: null, country: "US",
  apps: [{ app: "hinge", status: "setting_up", userPaused: false, reason: null, changedAt: null }], packStatus: "ready", photoCount: 4, flaggedPhotos: 0, hold: null, lastEventAt: null, ...o
});
const row = (o: Partial<QueueInput> & { id: string }): QueueRow => buildRow(input(o), NOW);

// the wait starts at the later of onboarding and payment
assert.equal(waitingSinceOf({ onboardingDoneAt: ago(100), paid: true, paidAt: ago(10) }), ago(10), "paid later: the 72 h promise starts at payment");
assert.equal(waitingSinceOf({ onboardingDoneAt: ago(10), paid: true, paidAt: ago(100) }), ago(10));
assert.equal(waitingSinceOf({ onboardingDoneAt: ago(10), paid: false, paidAt: ago(100) }), ago(10), "an unpaid user's paidAt is ignored");
assert.equal(row({ id: "a", onboardingDoneAt: ago(30) }).hoursWaiting, 30);
assert.equal(row({ id: "a", onboardingDoneAt: ago(30) }).sla, "amber");
assert.equal(buildRow(input({ id: "future", onboardingDoneAt: new Date(NOW.getTime() + H).toISOString() }), NOW).hoursWaiting, 0, "a clock skew never gives negative hours");

// country
assert.equal(countrySupport("us"), "supported");
assert.equal(countrySupport("DE"), "unsupported");
assert.equal(countrySupport(null), "unknown");
assert.equal(countrySupport("USA"), "unknown");

// ---------- order ----------
{
  const rows = [
    row({ id: "unpaid-de-old", country: "DE", onboardingDoneAt: ago(200) }),
    row({ id: "unpaid-us-new", onboardingDoneAt: ago(5) }),
    row({ id: "held-paid", paid: true, paidAt: ago(100), onboardingDoneAt: ago(100), hold: "paused" }),
    row({ id: "paid-new", paid: true, paidAt: ago(2), onboardingDoneAt: ago(2) }),
    row({ id: "paid-old", paid: true, paidAt: ago(80), onboardingDoneAt: ago(90) }),
    row({ id: "unpaid-us-old", onboardingDoneAt: ago(150) }),
    row({ id: "paid-done", paid: true, paidAt: ago(300), onboardingDoneAt: ago(300), apps: [{ app: "hinge", status: "active", userPaused: false, reason: null, changedAt: ago(200) }] })
  ].sort(compareQueue);
  assert.deepEqual(rows.map((r) => r.userId), ["paid-old", "paid-new", "paid-done", "unpaid-us-old", "unpaid-us-new", "unpaid-de-old", "held-paid"],
    "paid first (waiting before handled, oldest first), then unpaid in a supported country, then unpaid outside the list, report holds last");

  // filters
  assert.deepEqual(applyFilters(rows, parseFilters({ paid: "paid" })).map((r) => r.userId), ["paid-old", "paid-new", "paid-done", "held-paid"]);
  assert.deepEqual(applyFilters(rows, parseFilters({ paid: "unpaid", country: "unsupported" })).map((r) => r.userId), ["unpaid-de-old"]);
  assert.equal(applyFilters(rows, parseFilters({ country: "unknown" })).length, 0);
  assert.equal(applyFilters(rows, parseFilters({ app: "tinder" })).length, 0, "no one chose Tinder");
  assert.equal(applyFilters(rows, parseFilters({ app: "hinge" })).length, rows.length);
  assert.deepEqual(parseFilters({ paid: "x", country: "y", app: "z" }), { paid: null, country: null, app: null }, "junk in the URL means no filter");
}

// ---------- status workflow rules ----------
assert.deepEqual([...WORKFLOW_STATUSES], ["awaiting_login", "setting_up", "needs_client_action", "active", "paused", "closed"]);
for (const legacy of ["setting_up", "live", "paused"]) assert.ok((APP_STATUSES as readonly string[]).includes(legacy), `the migration check stays a superset: ${legacy}`);
assert.deepEqual(parseStatusChange({ status: "needs_client_action", reason: "  Add 2 more   photos " }), { ok: true, change: { status: "needs_client_action", reason: "Add 2 more photos" } });
assert.equal(parseStatusChange({ status: "needs_client_action" }).ok, false, "a reason is required");
assert.equal(parseStatusChange({ status: "needs_client_action", reason: "ab" }).ok, false);
assert.equal(parseStatusChange({ status: "needs_client_action", reason: "x".repeat(201) }).ok, false);
assert.deepEqual(parseStatusChange({ status: "active", reason: "stale reason" }), { ok: true, change: { status: "active", reason: null } }, "the reason never outlives needs_client_action");
assert.equal(parseStatusChange({ status: "live" }).ok, false, "the console does not offer the legacy name");
assert.equal(parseStatusChange({ status: "live" }, { allowLegacy: true }).ok, true, "the worker API still may");
assert.equal(parseStatusChange({ status: "bogus" }).ok, false);
assert.equal(isActiveStatus("live"), true); assert.equal(isActiveStatus("active"), true); assert.equal(isActiveStatus("setting_up"), false);
assert.equal(STATUS_LABELS.live, STATUS_LABELS.active);
assert.deepEqual(canAiSend("ai", "closed"), { ok: false, reason: "app_paused" }, "nothing is sent for a closed app");
assert.deepEqual(canAiSend("ai", "needs_client_action"), { ok: true });
assert.equal(effectiveStatus({ status: "active", user_paused: true }), "paused");

// ---------- client copy ----------
{
  const acct = (status: Parameters<typeof appCopy>[0]["status"], extra: Partial<Parameters<typeof appCopy>[0]> = {}) => ({ app: "hinge" as const, status, user_paused: false, client_action_reason: null, ...extra });
  const paid = { paid: true, hoursWaiting: 3 };
  const c = appCopy(acct("setting_up"), paid);
  assert.equal(c.label, "Setting up"); assert.equal(c.actor, "us");
  assert.equal(c.text, "We're setting up your Hinge. A person on our team will start within 72 hours.");
  const need = appCopy(acct("needs_client_action", { client_action_reason: "Add 2 more photos" }), paid);
  assert.equal(need.label, "Needs you"); assert.equal(need.actor, "you");
  assert.match(need.text, /^We need something from you: Add 2 more photos\./);
  assert.match(appCopy(acct("needs_client_action", { client_action_reason: "Log in on a fresh browser profile." }), paid).text, /fresh browser profile\. We continue/, "no double full stop");
  assert.match(appCopy(acct("needs_client_action"), paid).text, /open Profile/, "a missing reason still reads sensibly");
  assert.equal(appCopy(acct("active"), paid).label, "Running");
  assert.equal(appCopy(acct("live"), paid).label, "Running");
  assert.equal(appCopy(acct("paused"), paid).label, "Paused");
  assert.equal(appCopy(acct("closed"), paid).label, "Closed");
  assert.match(appCopy(acct("setting_up"), { paid: false }).text, /Waiting for you to activate NoSwipe/);
  assert.match(appCopy(acct("setting_up"), { paid: true, hoursWaiting: START_WITHIN_HOURS + 1 }).text, /taking longer than the 72 hours we said/, "a late start is admitted, not hidden");
  assert.match(appCopy(acct("setting_up"), { paid: true, hoursWaiting: START_WITHIN_HOURS }).text, /will start within 72 hours/);
  // user pause and report hold override whatever the team set
  assert.match(appCopy(acct("active", { user_paused: true }), paid).text, /You paused Hinge/);
  assert.equal(appCopy(acct("needs_client_action", { client_action_reason: "x y z" }), { ...paid, hold: "paused" }).label, "Paused", "a report hold overrides the status");
  assert.equal(appCopy(acct("active"), { ...paid, hold: "closed" }).label, "Closed");
  assert.doesNotMatch(appCopy(acct("active"), { ...paid, hold: "paused" }).text, /running/i);
  // honesty: no promised counts or fake activity, in any state
  const states = [...APP_STATUSES].flatMap((s) => [acct(s, { client_action_reason: "Add 2 more photos" }), acct(s, { user_paused: true })]);
  for (const a of states) for (const ctx of [paid, { paid: false }, { ...paid, hold: "paused" as const }]) {
    const t = appCopy(a, ctx).text;
    assert.doesNotMatch(t, /\b\d+ (matches|dates|chats)\b|swiping|swiped|just now|right now/i, `no promised numbers or fake activity: ${t}`);
  }
  // the resume card promises nothing that has not started
  assert.doesNotMatch(`${RESUME_COPY.title} ${RESUME_COPY.body} ${RESUME_COPY.doneBody}`, /swipes|swiping|chats in your voice|books the date/i);
  for (const [k, v] of Object.entries(RESUME_COPY)) assert.equal(RESUME_FORBIDDEN.test(v), false, `resume copy "${k}" uses a banned word`);
  assert.match(RESUME_COPY.body, /within 72 hours/);
}

// ---------- alert rules ----------
{
  const waitingPaid = (o: Partial<QueueInput> = {}) => row({ id: "p", paid: true, paidAt: ago(30), onboardingDoneAt: ago(40), ...o });
  assert.equal(needsAlert(waitingPaid()), true);
  assert.equal(needsAlert(waitingPaid({ paid: false, paidAt: null })), false, "unpaid clients are never alerted");
  assert.equal(needsAlert(waitingPaid({ paidAt: ago(23), onboardingDoneAt: ago(40) })), false, "under 24 h since paying");
  assert.equal(needsAlert(waitingPaid({ paidAt: ago(24) })), true);
  assert.equal(needsAlert(waitingPaid({ hold: "paused" })), false, "a report hold is not a fulfilment wait");
  assert.equal(needsAlert(waitingPaid({ apps: [{ app: "hinge", status: "needs_client_action", userPaused: false, reason: "Add photos", changedAt: ago(5) }] })), false, "someone already acted");
  assert.equal(needsAlert(waitingPaid({ apps: [{ app: "hinge", status: "setting_up", userPaused: false, reason: null, changedAt: ago(2) }] })), false, "a status change since the wait began");
  assert.equal(needsAlert(waitingPaid({ apps: [{ app: "hinge", status: "setting_up", userPaused: false, reason: null, changedAt: ago(500) }] })), true, "an old change from before the wait does not count");
  assert.equal(needsAlert(waitingPaid({ lastEventAt: ago(3) })), false, "a note or status log entry counts as a touch");
  assert.equal(needsAlert(waitingPaid({ apps: [] })), true, "paid but no apps chosen still needs a human");
  assert.equal(needsAlert(waitingPaid({ apps: [{ app: "hinge", status: "active", userPaused: false, reason: null, changedAt: ago(200) }] })), false, "already active");
  assert.equal(alertKey("u1", new Date("2026-11-20T23:59:59Z")), "alert:u1:2026-11-20");
  assert.notEqual(alertKey("u1", new Date("2026-11-20T23:59:59Z")), alertKey("u1", new Date("2026-11-21T00:00:01Z")));
  const line = opsLine(waitingPaid({ firstName: "SECRETNAME", email: "secret@real.org" }), "https://noswipe.app/admin/clients/p");
  assert.doesNotMatch(line, /SECRETNAME|secret@/); assert.match(line, /Paid client waiting 30 h/); assert.equal(line.split("\n").length, 1);
}

// ---------- in-memory Supabase ----------
type R = Record<string, unknown>;
class Fake {
  tables: Record<string, R[]> = { profiles: [], app_accounts: [], reservations: [], funnel_events: [], starter_packs: [], profile_photos: [], photo_flags: [], fulfilment_events: [] };
  users: { id: string; email: string }[] = [];
  missing: Record<string, string[]> = {};
  failInsert = new Set<string>();
  seq = 0;
  from(table: string) { return new Q(this, table); }
  auth = { admin: { listUsers: async () => ({ data: { users: this.users }, error: null }) } };
}
class Q implements PromiseLike<{ data: unknown; error: { code: string } | null }> {
  private f: ((r: R) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: R = {}; private cols = ""; private lim = Infinity; private ord: [string, boolean] | null = null; private conflict = "";
  constructor(private db: Fake, private table: string) {}
  select(c?: string) { this.cols = c ?? ""; return this; }
  insert(p: R) { this.op = "insert"; this.payload = p; return this; }
  upsert(p: R, o: { onConflict: string }) { this.op = "upsert"; this.payload = p; this.conflict = o.onConflict; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.f.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: null) { this.f.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string) { this.f.push((r) => r[c] != null); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord = [c, o?.ascending !== false]; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { return this.run(true); }
  then<A, B>(a?: ((v: { data: unknown; error: { code: string } | null }) => A | PromiseLike<A>) | null, b?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run(false).then(a, b); }
  private async run(single: boolean) {
    const rows = this.db.tables[this.table];
    if (!rows) return { data: null, error: { code: "42P01" } };
    const gone = this.db.missing[this.table] ?? [];
    const touched = this.op === "select" ? this.cols.split(",").map((c) => c.trim()) : Object.keys(this.payload);
    if (gone.some((c) => touched.includes(c))) return { data: null, error: { code: "42703" } };
    const match = rows.filter((r) => this.f.every((t) => t(r)));
    if (this.op === "insert" || this.op === "upsert") {
      if (this.db.failInsert.has(this.table)) return { data: null, error: { code: "XX000" } };
      if (this.op === "upsert") {
        const keys = this.conflict.split(",");
        const hit = rows.find((r) => keys.every((k) => r[k] === this.payload[k]));
        if (hit) { Object.assign(hit, this.payload); return { data: null, error: null }; }
      }
      const dedupe = this.payload.dedupe_key;
      if (dedupe && rows.some((r) => r.dedupe_key === dedupe)) return { data: null, error: { code: "23505" } };
      const n = ++this.db.seq;
      rows.push({ id: `row-${n}`, at: new Date(Date.now() + n).toISOString(), ...this.payload });
      return { data: null, error: null };
    }
    if (this.op === "delete") { for (const r of match) rows.splice(rows.indexOf(r), 1); return { data: null, error: null }; }
    let out = [...match];
    if (this.ord) { const [c, asc] = this.ord; out.sort((a, b) => (String(a[c]) > String(b[c]) ? 1 : -1) * (asc ? 1 : -1)); }
    out = out.slice(0, this.lim).map((r) => structuredClone(r));
    return single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
  }
}
const sb = (db: Fake) => db as unknown as Parameters<typeof loadQueue>[0];

// no PII in logs: capture everything the code writes to the console
const logged: string[] = [];
const origError = console.error;
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };

// stubbed ops bot
const sent: { text: string }[] = [];
let botOk = true;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
  const body = JSON.parse(init?.body ?? "{}") as { text: string };
  if (botOk) sent.push({ text: body.text });
  return { ok: botOk, status: botOk ? 200 : 500 } as Response;
}) as typeof fetch;

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function world() {
  const db = new Fake();
  const person = (n: number, p: { email: string; done: number; internal?: boolean; hold?: string | null; name?: string }) => {
    db.users.push({ id: U(n), email: p.email });
    db.tables.profiles.push({ user_id: U(n), first_name: p.name ?? `Name${n}`, internal: !!p.internal, onboarding_done_at: ago(p.done), created_at: ago(p.done + 1), report_hold: p.hold ?? null });
  };
  const pay = (n: number, email: string, hoursAgo: number, country: string | null, extra: R = {}) => db.tables.reservations.push({ email, status: "paid", paid_at: ago(hoursAgo), created_at: ago(hoursAgo + 1), stripe_checkout_session_id: `cs_live_${n}`, billing_country: country, ...extra });
  const apps = (n: number, ...list: [string, string, string | null?][]) => { for (const [app, status, changed] of list) db.tables.app_accounts.push({ user_id: U(n), app, status, user_paused: false, client_action_reason: null, status_changed_at: changed ?? null }); };
  person(1, { email: "paid.waiting@real.org", done: 40 }); pay(1, "paid.waiting@real.org", 30, "US"); apps(1, ["hinge", "setting_up"], ["tinder", "setting_up"]);
  person(2, { email: "unpaid.de@real.org", done: 100 }); apps(2, ["bumble", "setting_up"]);
  db.tables.reservations.push({ email: "unpaid.de@real.org", status: "pending", paid_at: null, created_at: ago(101), stripe_checkout_session_id: "cs_live_2", billing_country: null });
  db.tables.funnel_events.push({ dedupe_key: "checkout_created:cs_live_2", country: "DE" });
  person(3, { email: "internal@real.org", done: 100, internal: true });
  person(4, { email: "tester.test@real.org", done: 100 }); pay(4, "tester.test@real.org", 90, "US");
  person(5, { email: "paid.noapps@real.org", done: 50 }); pay(5, "paid.noapps@real.org", 49, "GB");
  person(6, { email: "paid.held@real.org", done: 100, hold: "paused" }); pay(6, "paid.held@real.org", 99, "US"); apps(6, ["hinge", "paused"]);
  person(7, { email: "paid.touched@real.org", done: 60 }); pay(7, "paid.touched@real.org", 55, "CA"); apps(7, ["hinge", "needs_client_action", ago(10)]);
  person(8, { email: "founder@real.org", done: 100 }); db.tables.reservations.push({ email: "founder@real.org", status: "paid", paid_at: ago(90), created_at: ago(91), stripe_checkout_session_id: "cs_test_zzz", billing_country: "US" });
  person(9, { email: "paid.fresh@real.org", done: 3 }); pay(9, "paid.fresh@real.org", 2, "NZ"); apps(9, ["hinge", "setting_up"]);
  person(10, { email: "paid.late@real.org", done: 200 }); pay(10, "paid.late@real.org", 26, "AU", {}); apps(10, ["hinge", "setting_up"]);
  return db;
}

process.env.NOSWIPE_OPS_BOT_TOKEN = "TOKEN-SECRET"; process.env.NOSWIPE_OPS_CHAT_ID = "-100123"; process.env.SITE_URL = "https://noswipe.app";

// ---------- loadQueue ----------
{
  const db = world();
  const q = await loadQueue(sb(db), NOW);
  const ids = q.rows.map((r) => r.userId);
  assert.ok(!ids.includes(U(3)), "profiles.internal are excluded");
  assert.ok(!ids.includes(U(4)), "test email addresses are excluded");
  assert.ok(!ids.includes(U(8)) || !q.rows.find((r) => r.userId === U(8))!.paid, "a Stripe test-mode payment is not a paid client");
  const by = (n: number) => q.rows.find((r) => r.userId === U(n))!;
  assert.equal(by(1).paid, true); assert.equal(by(1).country, "US"); assert.equal(by(1).hoursWaiting, 30, "waiting from payment, the later of the two");
  assert.equal(by(2).paid, false); assert.equal(by(2).country, "DE", "unpaid country comes from the checkout the client opened"); assert.equal(by(2).countrySupport, "unsupported");
  assert.equal(by(5).apps.length, 0, "a user with no app_accounts still appears");
  assert.equal(by(6).hold, "paused");
  assert.equal(by(7).apps[0].reason, null);
  const sorted = [...q.rows].sort(compareQueue).map((r) => r.userId);
  assert.ok(sorted.indexOf(U(2)) > sorted.indexOf(U(9)), "unpaid, unsupported country: after every paid client");
  assert.equal(sorted.at(-1), U(6), "report hold last");
  assert.equal(q.setupNeeded.events, false);

  // before the migrations: no new columns, no events table, no report_hold
  const old = world();
  old.missing = { app_accounts: ["client_action_reason", "status_changed_at"], reservations: ["billing_country"], profiles: ["report_hold"] };
  delete (old.tables as Record<string, unknown>).fulfilment_events;
  for (const r of old.tables.reservations) delete r.billing_country;
  const q2 = await loadQueue(sb(old), NOW);
  assert.ok(q2.rows.length >= 6, "the queue still renders before the migrations"); assert.equal(q2.setupNeeded.events, true);
  assert.equal(q2.rows.find((r) => r.userId === U(1))!.country, null, "no billing_country column: unknown, not a crash");
}

// ---------- changeAppStatus: workflow + audit log ----------
{
  const db = world();
  const admin = "miko@noswipe.app";
  const r1 = await changeAppStatus(sb(db), admin, U(1), "hinge", { status: "needs_client_action", reason: "Add 2 more photos", note: "only 2 clear face shots" });
  assert.ok(r1.ok && r1.logged);
  const acct = db.tables.app_accounts.find((a) => a.user_id === U(1) && a.app === "hinge")!;
  assert.equal(acct.status, "needs_client_action"); assert.equal(acct.client_action_reason, "Add 2 more photos"); assert.ok(acct.status_changed_at);
  const ev = db.tables.fulfilment_events[0];
  assert.equal(ev.actor, admin); assert.equal(ev.from_status, "setting_up"); assert.equal(ev.to_status, "needs_client_action"); assert.equal(ev.app, "hinge"); assert.equal(ev.note, "only 2 clear face shots"); assert.ok(ev.at);
  assert.equal(db.tables.app_accounts.find((a) => a.user_id === U(1) && a.app === "tinder")!.status, "setting_up", "other apps are untouched");

  const r2 = await changeAppStatus(sb(db), admin, U(1), "hinge", { status: "active", reason: "should be dropped" });
  assert.ok(r2.ok); assert.equal(acct.client_action_reason, null, "the old reason is cleared"); assert.equal(db.tables.fulfilment_events.length, 2);
  assert.equal((await changeAppStatus(sb(db), admin, U(1), "hinge", { status: "needs_client_action" })).ok, false, "no reason, no change");
  assert.equal(db.tables.fulfilment_events.length, 2, "a rejected change logs nothing");
  assert.equal(db.tables.app_accounts.find((a) => a.user_id === U(1) && a.app === "hinge")!.status, "active");
  assert.equal((await changeAppStatus(sb(db), admin, U(1), "okcupid", { status: "active" })).ok, false);
  // creating the row for an app the user did not choose still logs "none -> status"
  const r3 = await changeAppStatus(sb(db), admin, U(5), "tinder", { status: "setting_up" });
  assert.ok(r3.ok); assert.equal(db.tables.fulfilment_events.at(-1)!.from_status, null);
  // worker API actor
  await changeAppStatus(sb(db), "automation", U(1), "tinder", { status: "live" });
  assert.equal(db.tables.fulfilment_events.at(-1)!.actor, "automation");
  // notes
  assert.ok((await addNoteEvent(sb(db), admin, U(1), "called, voicemail", "hinge")).ok);
  assert.equal((await addNoteEvent(sb(db), admin, U(1), "   ")).ok, false);
  const listed = await listEvents(sb(db), U(1));
  assert.equal(listed.events[0].action, "note"); assert.ok(listed.events.length >= 4);
  // a status saved but not logged is reported
  db.failInsert.add("fulfilment_events");
  const r4 = await changeAppStatus(sb(db), admin, U(1), "hinge", { status: "paused" });
  assert.ok(r4.ok && !r4.logged, "the caller can tell the log write failed");

  // before the migration: old statuses still save, new ones explain themselves
  const old = world();
  old.missing = { app_accounts: ["client_action_reason", "status_changed_at"] };
  assert.ok((await changeAppStatus(sb(old), "automation", U(1), "hinge", { status: "live" })).ok);
  assert.equal(old.tables.app_accounts.find((a) => a.user_id === U(1) && a.app === "hinge")!.status, "live");
  const blocked = await changeAppStatus(sb(old), admin, U(1), "hinge", { status: "closed" });
  assert.ok(!blocked.ok && /fulfilment\.sql/.test(blocked.message));
}

// ---------- the sweep ----------
{
  const db = world();
  sent.length = 0;
  const r1 = await runFulfilmentSweep(sb(db), NOW);
  // due: 1 (paid 30 h, untouched), 5 (paid, no apps, 49 h), 10 (paid 26 h). Not: 2 unpaid, 6 held, 7 touched, 9 fresh, test/internal.
  assert.equal(r1.due, 3); assert.equal(r1.alerted, 3);
  assert.equal(sent.length, 3, "one ops line per client");
  for (const s of sent) { assert.equal(s.text.split("\n").length, 1); assert.doesNotMatch(s.text, /@|Name\d|real\.org/, "no name or email in the ops line"); assert.match(s.text, /^⏳ Paid client waiting \d+ h with no status change/); }
  assert.ok(sent.some((s) => /no apps chosen/.test(s.text)));
  assert.ok(sent.some((s) => s.text.includes(`https://noswipe.app/admin/clients/${U(1)}`)));
  const again = await runFulfilmentSweep(sb(db), new Date(NOW.getTime() + 10 * 60_000));
  assert.equal(again.alerted, 0); assert.equal(sent.length, 3, "overlapping or repeated runs the same day never double-send");
  const tomorrow = await runFulfilmentSweep(sb(db), new Date(NOW.getTime() + 24 * H));
  assert.ok(tomorrow.alerted >= 3, "still untouched the next day: one more line per client");
  assert.equal(sent.length, 3 + tomorrow.alerted);

  // a person touches client 1 -> no more alerts for them
  await changeAppStatus(sb(db), "miko@noswipe.app", U(1), "hinge", { status: "needs_client_action", reason: "Add 2 more photos" });
  sent.length = 0;
  await runFulfilmentSweep(sb(db), new Date(NOW.getTime() + 48 * H));
  assert.ok(!sent.some((s) => s.text.includes(U(1))));

  // ops bot down: the claim is released so the next run retries
  const down = world();
  botOk = false;
  const failed = await runFulfilmentSweep(sb(down), NOW);
  assert.equal(failed.alerted, 0); assert.equal(down.tables.fulfilment_events.filter((e) => e.action === "alert").length, 0, "no claim left behind");
  botOk = true; sent.length = 0;
  assert.equal((await runFulfilmentSweep(sb(down), NOW)).alerted, 3);

  // ops bot not configured: nothing claimed, nothing thrown
  const quiet = world();
  const token = process.env.NOSWIPE_OPS_BOT_TOKEN; delete process.env.NOSWIPE_OPS_BOT_TOKEN;
  const skipped = await runFulfilmentSweep(sb(quiet), NOW);
  assert.equal(skipped.skipped, "ops_not_configured"); assert.equal(quiet.tables.fulfilment_events.length, 0);
  process.env.NOSWIPE_OPS_BOT_TOKEN = token;

  // migration not applied: no alerts (they could not be deduplicated)
  const bare = world(); delete (bare.tables as Record<string, unknown>).fulfilment_events;
  assert.equal((await runFulfilmentSweep(sb(bare), NOW)).skipped, "not_set_up");
}

// ---------- the cron route ----------
{
  const { GET } = await import("../src/app/api/cron/fulfilment/route");
  process.env.CRON_SECRET = "cron-secret-value"; process.env.STARTER_PACK_SWEEP_TOKEN = "sweep-token-value";
  const call = (auth?: string) => GET(new Request("https://noswipe.app/api/cron/fulfilment", { headers: auth ? { authorization: auth } : {} }));
  assert.equal((await call()).status, 401, "no token");
  assert.equal((await call("Bearer nope")).status, 401, "wrong token");
  assert.equal((await call("Bearer cron-secret-valu")).status, 401, "length mismatch is rejected, not thrown");
  for (const token of ["cron-secret-value", "sweep-token-value"]) {
    const status = (await call(`Bearer ${token}`)).status;
    assert.notEqual(status, 401, "either secret is accepted (503 here: no database in this test)");
  }
  delete process.env.CRON_SECRET; delete process.env.STARTER_PACK_SWEEP_TOKEN;
  assert.equal((await call("Bearer undefined")).status, 401, "no secrets configured means nothing is authorised");
}

// ---------- logs ----------
console.error = origError; globalThis.fetch = realFetch;
assert.ok(!logged.join("\n").match(/@real\.org|Name\d|TOKEN-SECRET|Add 2 more photos|only 2 clear/), "no email, name, token, reason or note ever reaches the log");

// ---------- migration file + wiring ----------
{
  const sql = read("../supabase/2026-11-20-fulfilment.sql");
  assert.match(sql, /status in \('setting_up', 'needs_client_action', 'active', 'live', 'paused', 'closed'\)/, "a superset of setting_up/live/paused");
  assert.match(sql, /add column if not exists client_action_reason/); assert.match(sql, /add column if not exists status_changed_at/);
  assert.doesNotMatch(sql, /operator_notes|add column if not exists note/, "notes never go on a table the client can read");
  assert.match(sql, /create table if not exists public\.fulfilment_events/);
  assert.match(sql, /enable row level security/); assert.match(sql, /revoke all on public\.fulfilment_events from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*fulfilment_events to (anon|authenticated)/);
  assert.match(sql, /create unique index if not exists fulfilment_events_dedupe_idx/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from|update public\.app_accounts set/i, "additive: no data is touched");
  for (const line of sql.split("\n")) if (/^\s*create (table|index|unique index)/i.test(line)) assert.match(line, /if not exists/, line);
  assert.match(read("../src/app/admin/_components/admin-nav.tsx"), /LINKS = \[\s*\{ href: "\/admin\/fulfilment"/, "the nav link is first");
  assert.match(read("../src/app/admin/fulfilment/page.tsx"), /requireAdminPage/, "the queue page checks the admin itself");
  assert.match(read("../src/app/admin/clients/actions.ts"), /adminEmailOrNull\(\);\s*if \(!admin/, "status changes are admin-only and logged with the admin's email");
  assert.doesNotMatch(read("../src/lib/fulfilment/service.ts"), /console\.error\([^)]*(email|reason|note|first_name)/i);
}

console.log("check-fulfilment: ok");
