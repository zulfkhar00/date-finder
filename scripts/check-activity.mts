// Done-for-you accounts: the activity feed the phone rig writes (validation, idempotency, time bounds, needs-you), "today" in the
// viewer's time zone, the rig's job list (shouldRun), the operator's Run panel, the client-facing copy for every account state, the
// onboarding (no connect step, no handoff) and the migration file. No network, no database: an in-memory Supabase.
// Run with: node --conditions=react-server --import tsx scripts/check-activity.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventSchema, occurredAtOk, summarizeToday, dayKey, type ActivityRow } from "../src/lib/app/activity";
import { APP_STATUSES, WORKFLOW_STATUSES, CONSENT_STATEMENT, effectiveStatus, stepSchemas } from "../src/lib/app/domain";
import { payloadFor, draftFrom } from "../src/lib/app/draft";
import { appCopy, START_WITHIN_HOURS } from "../src/lib/app/status-copy";
import { getRunPanel, ingestEvents, listRuns, setRun } from "../src/lib/activity/service";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const NOW = new Date("2026-11-21T20:00:00Z"); // 12:00 in Los Angeles, 21:00 in London
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000, HOUR = 3_600_000;
const U = "11111111-1111-4111-8111-111111111111";

// ---------- event validation ----------
{
  const ok = (e: unknown) => eventSchema.safeParse(e).success;
  assert.ok(ok({ kind: "swipes", app: "hinge", idempotencyKey: "swp-0001-aaaa", count: 40 }));
  assert.ok(!ok({ kind: "swipes", app: "hinge", idempotencyKey: "swp-0001-aaaa", count: 0 }), "a swipe batch is at least 1");
  assert.ok(!ok({ kind: "swipes", app: "hinge", idempotencyKey: "swp-0001-aaaa", count: 10001 }));
  assert.ok(!ok({ kind: "swipes", app: "hinge", idempotencyKey: "swp-0001-aaaa", count: 1.5 }));
  assert.ok(!ok({ kind: "swipes", app: "grindr", idempotencyKey: "swp-0001-aaaa", count: 1 }), "unknown app");
  assert.ok(!ok({ kind: "swipes", app: "hinge", idempotencyKey: "short", count: 1 }), "the idempotency key is required and not trivial");
  assert.ok(!ok({ kind: "swipes", app: "hinge", count: 1 }), "no idempotency key, no event");
  assert.ok(!ok({ kind: "like", app: "hinge", idempotencyKey: "swp-0001-aaaa" }), "unknown kind");
  assert.ok(ok({ kind: "match", app: "tinder", idempotencyKey: "mat-0001-aaaa" }));
  assert.ok(ok({ kind: "chat", app: "bumble", idempotencyKey: "cht-0001-aaaa", matchRef: "m-1" }));
  assert.ok(!ok({ kind: "chat", app: "bumble", idempotencyKey: "cht-0001-aaaa" }), "a chat event names its chat");
  assert.ok(ok({ kind: "needs_you", app: "tinder", idempotencyKey: "ney-0001-aaaa", reason: "Tinder asked for a selfie" }));
  assert.ok(!ok({ kind: "needs_you", app: "tinder", idempotencyKey: "ney-0001-aaaa", reason: "x" }), "the client reads the reason, so it has to say something");
  assert.ok(!ok({ kind: "needs_you", app: "tinder", idempotencyKey: "ney-0001-aaaa", reason: "x".repeat(201) }));
  const date = { kind: "date_booked", app: "hinge", idempotencyKey: "dat-0001-aaaa", who: "Maya", venue: "Taqueria", startsAt: "2026-11-26T19:00:00Z" };
  assert.ok(ok(date));
  assert.ok(!ok({ ...date, startsAt: "Thursday 7pm" }), "a date has a real time");
  assert.ok(!ok({ ...date, venue: "" }));
  assert.ok(!ok({ ...date, occurredAt: "yesterday" }));
}

// ---------- time bounds ----------
assert.equal(occurredAtOk(undefined, NOW.getTime()), true);
assert.equal(occurredAtOk(ago(2 * MIN), NOW.getTime()), true);
assert.equal(occurredAtOk(new Date(NOW.getTime() + 4 * MIN).toISOString(), NOW.getTime()), true, "a little clock skew is fine");
assert.equal(occurredAtOk(new Date(NOW.getTime() + 6 * MIN).toISOString(), NOW.getTime()), false, "the future is the rig's clock being wrong");
assert.equal(occurredAtOk(ago(8 * 24 * HOUR), NOW.getTime()), false, "older than a week is refused");
assert.equal(occurredAtOk("not a date", NOW.getTime()), false);

// ---------- today, in the viewer's own time zone ----------
{
  const row = (kind: ActivityRow["kind"], at: string, count = 1, ref: string | null = null, app: ActivityRow["app"] = "hinge"): ActivityRow => ({ app, kind, count, match_ref: ref, occurred_at: at });
  const rows: ActivityRow[] = [
    row("swipes", "2026-11-21T07:30:00Z", 40),   // 23:30 on the 20th in Los Angeles, 07:30 on the 21st in London
    row("swipes", "2026-11-21T19:00:00Z", 25),
    row("match", "2026-11-21T19:10:00Z"),
    row("chat", "2026-11-21T19:20:00Z", 1, "a"), row("chat", "2026-11-21T19:21:00Z", 1, "a"), row("chat", "2026-11-21T19:22:00Z", 1, "b"),
    row("date_booked", "2026-11-21T19:30:00Z"),
    row("swipes", "2026-11-20T10:00:00Z", 99),   // yesterday everywhere
    row("swipes", "2026-11-21T18:00:00Z", 5, null, "tinder")
  ];
  const la = summarizeToday(rows, NOW.getTime(), "America/Los_Angeles");
  assert.equal(la.hinge.swipes, 25, "23:30 yesterday (Los Angeles time) does not count as today");
  assert.equal(la.hinge.matches, 1);
  assert.equal(la.hinge.chatsActive, 2, "chats active counts different chats, not messages");
  assert.equal(la.hinge.datesBooked, 1);
  assert.equal(la.hinge.lastAt, "2026-11-21T19:30:00Z");
  assert.equal(la.tinder.swipes, 5, "stats are per app");
  assert.equal(la.bumble.events, 0);
  const london = summarizeToday(rows, NOW.getTime(), "Europe/London");
  assert.equal(london.hinge.swipes, 65, "the same events read differently in another time zone: 07:30 UTC is already the 21st in London");
  assert.equal(summarizeToday(rows, NOW.getTime(), "Not/AZone").hinge.swipes, 65, "an unknown zone falls back to UTC instead of throwing");
  assert.equal(dayKey(Date.parse("2026-11-21T07:30:00Z"), "America/Los_Angeles"), "2026-11-20");
  const empty = summarizeToday([], NOW.getTime(), "UTC");
  assert.deepEqual([empty.hinge.swipes, empty.hinge.events, empty.hinge.lastAt], [0, 0, null], "an empty feed is zeros, never fake numbers");
  assert.equal(summarizeToday([{ app: "hinge", kind: "swipes", count: 3, match_ref: null, occurred_at: "garbage" }], NOW.getTime(), "UTC").hinge.swipes, 0, "a broken timestamp never counts");
}

// ---------- in-memory Supabase ----------
type R = Record<string, unknown>;
class Fake {
  tables: Record<string, R[]> = { app_accounts: [], account_activity: [], account_runs: [], dates: [], matches: [], messages: [], profiles: [], fulfilment_events: [] };
  seq = 0;
  missingTables = new Set<string>();
  from(table: string) { return new Q(this, table); }
}
class Q implements PromiseLike<{ data: unknown; error: { code: string } | null }> {
  private f: ((r: R) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: R = {}; private lim = Infinity; private conflict = ""; private wantRow = false;
  constructor(private db: Fake, private table: string) {}
  select() { this.wantRow = true; return this; }
  insert(p: R) { this.op = "insert"; this.payload = p; return this; }
  update(p: R) { this.op = "update"; this.payload = p; return this; }
  upsert(p: R, o: { onConflict: string }) { this.op = "upsert"; this.payload = p; this.conflict = o.onConflict; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.f.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
  gte(c: string, v: string) { this.f.push((r) => String(r[c]) >= v); return this; }
  not(c: string) { this.f.push((r) => r[c] != null); return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { return this.run(true); }
  single() { return this.run(true); }
  then<A, B>(a?: ((v: { data: unknown; error: { code: string } | null }) => A | PromiseLike<A>) | null, b?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run(false).then(a, b); }
  private async run(single: boolean) {
    const rows = this.db.tables[this.table];
    if (!rows || this.db.missingTables.has(this.table)) return { data: null, error: { code: "42P01" } };
    const unique = (r: R) => {
      if (this.table === "account_activity") return rows.some((x) => x.user_id === r.user_id && x.idempotency_key === r.idempotency_key);
      if (this.table === "dates" && r.external_id) return rows.some((x) => x.user_id === r.user_id && x.external_id === r.external_id);
      return false;
    };
    if (this.op === "insert") {
      if (unique(this.payload)) return { data: null, error: { code: "23505" } };
      const row = { id: `row-${++this.db.seq}`, ...this.payload };
      rows.push(row);
      return { data: single ? { id: row.id } : [{ id: row.id }], error: null };
    }
    if (this.op === "upsert") {
      const keys = this.conflict.split(",");
      const hit = rows.find((r) => keys.every((k) => r[k] === this.payload[k]));
      if (hit) Object.assign(hit, this.payload); else rows.push({ id: `row-${++this.db.seq}`, ...this.payload });
      return { data: null, error: null };
    }
    const match = rows.filter((r) => this.f.every((t) => t(r)));
    if (this.op === "update") { for (const r of match) Object.assign(r, this.payload); return { data: null, error: null }; }
    if (this.op === "delete") { for (const r of match) rows.splice(rows.indexOf(r), 1); return { data: null, error: null }; }
    const out = match.slice(0, this.lim).map((r) => structuredClone(r));
    void this.wantRow;
    return single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
  }
}
const sb = (db: Fake) => db as unknown as Parameters<typeof ingestEvents>[0];
const world = () => {
  const db = new Fake();
  db.tables.profiles.push({ user_id: U, notify_email: false, onboarding_done_at: ago(2 * HOUR) }); // no email can ever be sent from these tests
  db.tables.app_accounts.push(
    { user_id: U, app: "hinge", status: "active", user_paused: false },
    { user_id: U, app: "tinder", status: "setting_up", user_paused: false }
  );
  return db;
};
const errors: string[] = [];
const realError = console.error;
console.error = (...a: unknown[]) => { errors.push(a.map(String).join(" ")); };

// ---------- ingest: created, duplicate, rejected ----------
{
  const db = world();
  const e = (n: number, extra: R = {}) => ({ kind: "swipes", app: "hinge", idempotencyKey: `swp-000${n}-aaaa`, count: 10, occurredAt: ago(MIN), ...extra });
  const first = await ingestEvents(sb(db), U, { events: [e(1), e(2)] }, NOW);
  assert.ok(first.ok);
  if (first.ok) { assert.equal(first.created, 2); assert.equal(first.duplicates, 0); assert.deepEqual(first.results.map((r) => r.status), ["created", "created"]); }
  assert.equal(db.tables.account_activity.length, 2);

  const replay = await ingestEvents(sb(db), U, { events: [e(1), e(2), e(3)] }, NOW);
  assert.ok(replay.ok);
  if (replay.ok) { assert.deepEqual(replay.results.map((r) => r.status), ["duplicate", "duplicate", "created"], "a retried batch counts nothing twice"); }
  assert.equal(db.tables.account_activity.length, 3, "the replayed events were not stored again");

  const same = await ingestEvents(sb(db), U, { events: [e(4), e(4)] }, NOW);
  assert.ok(same.ok);
  if (same.ok) assert.deepEqual(same.results.map((r) => r.status), ["created", "duplicate"], "the same key twice in one batch is one event");

  const mixed = await ingestEvents(sb(db), U, { events: [
    e(5, { app: "bumble" }), e(6, { occurredAt: new Date(NOW.getTime() + HOUR).toISOString() }), e(7, { count: 0 }), "junk", e(8)
  ] }, NOW);
  assert.ok(mixed.ok);
  if (mixed.ok) {
    assert.deepEqual(mixed.results.map((r) => (r.status === "rejected" ? r.code : r.status)), ["no_account", "bad_time", "invalid", "invalid", "created"], "each event is judged alone");
    assert.equal(mixed.rejected, 4);
  }
  assert.equal((await ingestEvents(sb(db), "not-a-uuid", { events: [e(9)] }, NOW) as { status?: number }).status, 404);
  assert.equal((await ingestEvents(sb(db), U, { events: [] }, NOW) as { status?: number }).status, 400);
  assert.equal((await ingestEvents(sb(db), U, { events: Array.from({ length: 201 }, (_, i) => e(i)) }, NOW) as { status?: number }).status, 400, "batches are capped at 200");
  // another client's key space is separate
  const V = "22222222-2222-4222-8222-222222222222";
  db.tables.app_accounts.push({ user_id: V, app: "hinge", status: "active", user_paused: false });
  const other = await ingestEvents(sb(db), V, { events: [e(1)] }, NOW);
  assert.ok(other.ok && other.created === 1, "an idempotency key is unique per client, not global");

  // the feed table is not there yet (migration not applied): say so, never pretend
  const gone = world();
  gone.missingTables.add("account_activity");
  const r = await ingestEvents(sb(gone), U, { events: [e(1)] }, NOW);
  assert.ok(!r.ok && r.status === 503 && r.code === "migration");
}

// ---------- date_booked: one date, ever ----------
{
  const db = world();
  const date = { kind: "date_booked", app: "hinge", idempotencyKey: "dat-0001-aaaa", who: "Maya", venue: "Taqueria on 5th", startsAt: "2026-11-26T19:00:00Z", occurredAt: ago(MIN), matchRef: "h-maya" };
  db.tables.matches.push({ id: "33333333-3333-4333-8333-333333333333", user_id: U, app: "hinge", external_id: "h-maya" });
  const a = await ingestEvents(sb(db), U, { events: [date] }, NOW);
  assert.ok(a.ok && a.created === 1);
  assert.equal(db.tables.dates.length, 1);
  assert.equal(db.tables.dates[0].match_id, "33333333-3333-4333-8333-333333333333", "the rig's match id is resolved to the client's chat");
  assert.equal(db.tables.dates[0].external_id, "activity:dat-0001-aaaa");
  const b = await ingestEvents(sb(db), U, { events: [date] }, NOW);
  assert.ok(b.ok && b.duplicates === 1);
  assert.equal(db.tables.dates.length, 1, "a replayed date event never books a second date");
  assert.equal(db.tables.account_activity.length, 1);
  // half-finished earlier attempt: the date exists, the activity row does not -> the retry completes it without a second date
  const half = world();
  half.tables.dates.push({ id: "d-0", user_id: U, external_id: "activity:dat-0002-aaaa" });
  const c = await ingestEvents(sb(half), U, { events: [{ ...date, idempotencyKey: "dat-0002-aaaa" }] }, NOW);
  assert.ok(c.ok && c.created === 1);
  assert.equal(half.tables.dates.length, 1);
  assert.equal(half.tables.account_activity.length, 1);
}

// ---------- needs_you ----------
{
  const db = world();
  const ney = (key: string, app = "hinge") => ({ kind: "needs_you", app, idempotencyKey: key, reason: "Hinge asked for a selfie to verify", occurredAt: ago(MIN) });
  await ingestEvents(sb(db), U, { events: [ney("ney-0001-aaaa")] }, NOW);
  const hinge = db.tables.app_accounts.find((a) => a.app === "hinge")!;
  assert.equal(hinge.status, "needs_client_action");
  assert.equal(hinge.client_action_reason, "Hinge asked for a selfie to verify", "the client reads the reason");
  // a pause the client chose is never overridden by the rig
  const paused = world();
  paused.tables.app_accounts.find((a) => a.app === "hinge")!.user_paused = true;
  await ingestEvents(sb(paused), U, { events: [ney("ney-0002-aaaa")] }, NOW);
  assert.equal(paused.tables.app_accounts.find((a) => a.app === "hinge")!.status, "active", "a user pause stays");
  const teamPaused = world();
  teamPaused.tables.app_accounts.find((a) => a.app === "hinge")!.status = "paused";
  await ingestEvents(sb(teamPaused), U, { events: [ney("ney-0003-aaaa")] }, NOW);
  assert.equal(teamPaused.tables.app_accounts.find((a) => a.app === "hinge")!.status, "paused", "a team pause stays");
  // a replay does not flip it again after an operator fixed it
  const fixed = world();
  await ingestEvents(sb(fixed), U, { events: [ney("ney-0004-aaaa")] }, NOW);
  fixed.tables.app_accounts.find((a) => a.app === "hinge")!.status = "active";
  await ingestEvents(sb(fixed), U, { events: [ney("ney-0004-aaaa")] }, NOW);
  assert.equal(fixed.tables.app_accounts.find((a) => a.app === "hinge")!.status, "active", "a duplicate needs_you does not undo the operator's fix");
}

// ---------- the rig's job list ----------
{
  const db = world();
  db.tables.account_runs.push({ user_id: U, app: "hinge", phone_id: "pi-1-phone-3", account_ref: "hinge-017" });
  const runs = await listRuns(sb(db));
  assert.ok(runs.ok);
  if (runs.ok) {
    const hinge = runs.runs.find((r) => r.app === "hinge")!;
    assert.equal(hinge.shouldRun, true);
    assert.equal(hinge.phoneId, "pi-1-phone-3");
    assert.equal(runs.runs.find((r) => r.app === "tinder")!.shouldRun, false, "setting up never runs");
  }
  const should = async (patch: R, withPhone = true, onboarded = true) => {
    const w = world();
    const acct = w.tables.app_accounts.find((a) => a.app === "hinge")!;
    Object.assign(acct, patch);
    if (!onboarded) w.tables.profiles[0].onboarding_done_at = null;
    if (withPhone) w.tables.account_runs.push({ user_id: U, app: "hinge", phone_id: "pi-1-phone-3", account_ref: null });
    const r = await listRuns(sb(w), { phoneId: withPhone ? "pi-1-phone-3" : undefined });
    return r.ok ? r.runs.find((x) => x.app === "hinge")!.shouldRun : null;
  };
  assert.equal(await should({}), true);
  assert.equal(await should({ user_paused: true }), false, "paused by the client: stop");
  assert.equal(await should({ status: "paused" }), false, "paused by the team: stop");
  assert.equal(await should({ status: "needs_client_action" }), false, "needs the client: stop");
  assert.equal(await should({ status: "closed" }), false);
  assert.equal(await should({}, false), false, "no phone assigned: nothing to run on");
  assert.equal(await should({}, true, false), false, "onboarding not finished: never run");
  assert.equal(await should({ status: "live" }), true, "the old name for active still runs");
  const filtered = await listRuns(sb(db), { phoneId: "pi-9" });
  assert.ok(filtered.ok && filtered.runs.length === 0, "the phone filter only returns that phone's jobs");
  // report hold
  const held = world();
  held.tables.account_runs.push({ user_id: U, app: "hinge", phone_id: "p", account_ref: null });
  held.tables.profiles[0].report_hold = "paused";
  const hr = await listRuns(sb(held));
  assert.ok(hr.ok && hr.runs.find((r) => r.app === "hinge")!.shouldRun === false && hr.runs.find((r) => r.app === "hinge")!.held, "a report hold stops the rig");
}

// ---------- Run panel ----------
{
  const db = world();
  const ok = await setRun(sb(db), "ops@noswipe.test", U, "hinge", { phoneId: " pi-1-phone-3 ", accountRef: "hinge-017" });
  assert.ok(ok.ok);
  assert.deepEqual([db.tables.account_runs[0].phone_id, db.tables.account_runs[0].account_ref, db.tables.account_runs[0].updated_by], ["pi-1-phone-3", "hinge-017", "ops@noswipe.test"]);
  assert.ok((await setRun(sb(db), "ops", U, "hinge", { phoneId: "pi-2" })).ok);
  assert.equal(db.tables.account_runs.length, 1, "reassigning updates the one row");
  assert.ok(!(await setRun(sb(db), "ops", U, "grindr", {})).ok);
  assert.ok(!(await setRun(sb(db), "ops", U, "hinge", { phoneId: "x".repeat(81) })).ok);
  const gone = world(); gone.missingTables.add("account_runs");
  const r = await setRun(sb(gone), "ops", U, "hinge", { phoneId: "p" });
  assert.ok(!r.ok && r.code === "migration");
  const panel = await getRunPanel(sb(world()), U);
  assert.equal(panel.setupNeeded, false);
  const noPanel = world(); noPanel.missingTables.add("account_activity");
  assert.equal((await getRunPanel(sb(noPanel), U)).setupNeeded, true, "a missing feed shows a setup notice, not an error");
}

// ---------- what the client reads on each card ----------
{
  const acct = (status: (typeof APP_STATUSES)[number], extra: R = {}) => ({ app: "hinge" as const, status, user_paused: false, client_action_reason: null, ...extra });
  const paid = { paid: true, hoursWaiting: 4 };
  const wait = appCopy(acct("awaiting_login"), paid);
  assert.equal(wait.label, "Setting up", "the retired awaiting_login state reads as setting up");
  assert.match(wait.text, /creating your Hinge profile/);
  assert.match(wait.text, /starts? within 72 hours/);
  assert.doesNotMatch(wait.text, /log ?in|invite|password/i, "the client is never asked to hand anything over");
  assert.match(appCopy(acct("setting_up"), { paid: true, hoursWaiting: START_WITHIN_HOURS + 1 }).text, /taking longer than the 72 hours we said/, "a late start is admitted");
  assert.equal(appCopy(acct("awaiting_login"), { paid: false }).label, "Not started", "before activation nothing is promised");
  assert.match(appCopy(acct("awaiting_login"), { paid: false }).text, /Waiting for you to activate/);
  const outside = appCopy(acct("awaiting_login"), { paid: false, paidOffered: false });
  assert.equal(outside.label, "Not available yet");
  assert.match(outside.text, /isn't offered in your country yet/);
  assert.match(outside.text, /starter pack and reply helper still work/, "the free tools are still there");
  assert.equal(appCopy(acct("awaiting_login"), { paid: true, paidOffered: false }).label, "Setting up", "a client who already pays is never told it is unavailable");
  assert.equal(appCopy(acct("active"), paid).label, "Running");
  assert.equal(appCopy(acct("needs_client_action", { client_action_reason: "Hinge asked for a selfie" }), paid).label, "Needs you");
  assert.equal(appCopy(acct("active", { user_paused: true }), paid).label, "Paused");
  assert.match(appCopy(acct("active", { user_paused: true }), paid).text, /Resume it/);
  assert.equal(appCopy(acct("setting_up"), paid).label, "Setting up");
  assert.equal(effectiveStatus({ status: "awaiting_login", user_paused: true }), "paused");
  assert.ok(!(WORKFLOW_STATUSES as readonly string[]).includes("awaiting_login") && (APP_STATUSES as readonly string[]).includes("awaiting_login"), "operators cannot set the retired state; old rows still read");
  // no copy for any state promises a count, a person's name or activity that did not happen
  for (const s of APP_STATUSES) for (const ctx of [paid, { paid: false }, { paid: false, paidOffered: false }, { ...paid, hold: "paused" as const }]) {
    const t = appCopy(acct(s, { client_action_reason: "Add 2 more photos" }), ctx).text;
    assert.doesNotMatch(t, /\b\d+ (matches|dates|chats|swipes)\b|just now|right now/i, `no promised numbers: ${t}`);
  }
}

// ---------- onboarding: no connect step, no handoff ----------
{
  assert.match(CONSENT_STATEMENT, /^NoSwipe creates and runs dating profiles for you/);
  const terms = read("../src/app/terms/page.tsx");
  assert.doesNotMatch(terms, /app by app|hand each app over|phone we set aside|invite we send|never ask for your password/i, "/terms has no handoff wording; privacy terms come later");
  assert.equal(stepSchemas.apps.safeParse({ apps: ["hinge"] }).success, true, "an app preference is just a list");
  const draft = draftFrom(null, null, ["hinge"]);
  assert.deepEqual(payloadFor("apps", draft), { apps: ["hinge"] }, "nothing but the preference is sent");
  const actions = read("../src/lib/app/actions.ts");
  assert.doesNotMatch(actions, /handoff|Agree for each app|consented_at/, "the server asks nothing per app");
  assert.match(actions, /status: "setting_up"/, "a picked app starts as setting up");
  for (const f of ["../src/app/onboarding/flow.tsx", "../src/components/app/mock/onboarding.tsx", "../src/components/app/step-fields.tsx", "../src/components/app/views.tsx", "../src/components/app/profile-client.tsx"]) {
    assert.doesNotMatch(read(f), /Connect your apps|Connect an app|one-time login|log in once/i, `${f} has no connect or login wording`);
  }
  assert.match(read("../src/components/app/views.tsx"), /We create your dating profiles and run them for you\. You just show up\./);
}

// ---------- the API routes and the migration ----------
{
  const route = read("../src/app/api/automation/v1/activity/route.ts");
  assert.match(route, /authorizeAutomation\(request\)/, "the activity endpoint uses the same bearer key as the rest of the automation API");
  assert.match(read("../src/app/api/automation/v1/runs/route.ts"), /authorizeAutomation\(request\)/);
  const env = { ...process.env };
  delete process.env.AUTOMATION_API_KEY;
  const { POST } = await import("../src/app/api/automation/v1/activity/route");
  const noKey = await POST(new Request("http://x/api/automation/v1/activity", { method: "POST", body: "{}" }));
  assert.equal(noKey.status, 503, "no key configured: the endpoint is off");
  process.env.AUTOMATION_API_KEY = "k".repeat(40);
  const wrong = await POST(new Request("http://x/api/automation/v1/activity", { method: "POST", headers: { authorization: "Bearer nope" }, body: "{}" }));
  assert.equal(wrong.status, 401);
  const missing = await POST(new Request("http://x/api/automation/v1/activity", { method: "POST" }));
  assert.equal(missing.status, 401, "no Authorization header: refused before anything is read");
  Object.assign(process.env, env);

  const sql = read("../supabase/2026-11-21-account-runs.sql");
  assert.match(sql, /^-- Done-for-you accounts/);
  for (const t of ["account_activity", "account_runs"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`), `${t} is created idempotently`);
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t} has RLS on`);
  }
  assert.match(sql, /revoke all on public\.account_activity, public\.account_runs from public, anon, authenticated/, "browser roles are revoked");
  assert.doesNotMatch(sql, /grant select[^;]*account_runs[^;]*to authenticated/i, "the phone assignment is server only");
  assert.match(sql, /grant select on public\.account_activity to authenticated/, "the client reads only their own activity");
  assert.match(sql, /create unique index if not exists account_activity_idem_idx on public\.account_activity \(user_id, idempotency_key\)/, "duplicates are refused by the database too");
  assert.match(sql, /create unique index if not exists dates_external_idx/);
  assert.doesNotMatch(sql, /\bdrop table\b|\bdelete from\b|\btruncate\b/i, "additive only");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter((s) => /^(alter table [^\n]* add column|create (unique )?index)/m.test(s))) assert.match(stmt, /if not exists/, `idempotent: ${stmt.slice(0, 60)}`);
  assert.doesNotMatch(sql, /^\s+(password|secret|token|credentials?|login_name|username)\s/mi, "no credential columns");
  for (const s of APP_STATUSES) assert.ok(sql.includes(`'${s}'`), `the status check allows ${s}`);
  assert.match(read("../docs/automation.md"), /POST \/activity/, "the rig's contract is documented");
}

// ---------- no contents in logs ----------
console.error = realError;
assert.deepEqual(errors.filter((l) => /Maya|Taqueria|selfie|pi-1-phone/i.test(l)), [], "nothing the rig or an operator wrote is logged");
console.log("activity checks ok");
