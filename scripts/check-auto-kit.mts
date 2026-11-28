// Automatic kit: a paid client who is setting up gets their kit without an operator, exactly once, and never over an operator's edits.
// In-memory Supabase, no network, nothing sent. Run with: node --conditions=react-server --import tsx scripts/check-auto-kit.mts
import assert from "node:assert/strict";
import { CONSENT_REASON, ensureKits, clearConsentRequest, sweepKits } from "../src/lib/operator/auto-kit";
import { generateKit } from "../src/lib/operator/service";

type R = Record<string, unknown>;
type Res = { data: unknown; error: { code: string } | null };
const UNIQUE: Record<string, string[]> = { account_kits: ["user_id", "app"] };
class Fake {
  tables: Record<string, R[]> = { profiles: [], app_accounts: [], reservations: [], starter_packs: [], profile_photos: [], photo_flags: [], preferences: [], account_kits: [], fulfilment_events: [], consents: [] };
  users: { id: string; email: string }[] = [];
  seq = 0;
  from(table: string) { return new Q(this, table); }
  auth = { admin: { getUserById: async (id: string) => ({ data: { user: this.users.find((u) => u.id === id) ?? null }, error: null }) } };
}
class Q implements PromiseLike<Res> {
  private f: ((r: R) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: R = {}; private lim = Infinity; private conflict = "";
  constructor(private db: Fake, private table: string) {}
  select() { return this; }
  insert(p: R) { this.op = "insert"; this.payload = p; return this; }
  update(p: R) { this.op = "update"; this.payload = p; return this; }
  upsert(p: R, o: { onConflict: string }) { this.op = "upsert"; this.payload = p; this.conflict = o.onConflict; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: null) { this.f.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { return this.run(true); }
  then<A, B>(a?: ((v: Res) => A | PromiseLike<A>) | null, b?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run(false).then(a, b); }
  private async run(single: boolean): Promise<Res> {
    const rows = this.db.tables[this.table];
    if (!rows) return { data: null, error: { code: "42P01" } };
    const match = rows.filter((r) => this.f.every((t) => t(r)));
    if (this.op === "insert" || this.op === "upsert") {
      const keys = this.op === "upsert" ? this.conflict.split(",") : UNIQUE[this.table];
      const hit = keys ? rows.find((r) => keys.every((k) => r[k] === this.payload[k])) : undefined;
      if (hit && this.op === "upsert") { Object.assign(hit, this.payload); return { data: null, error: null }; }
      if (hit) return { data: null, error: { code: "23505" } };
      const n = ++this.db.seq;
      rows.push({ id: `row-${n}`, ...this.payload });
      return { data: null, error: null };
    }
    if (this.op === "update") { for (const r of match) Object.assign(r, this.payload); return { data: null, error: null }; }
    const out = match.slice(0, this.lim).map((r) => structuredClone(r));
    return single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
  }
}
const sb = (db: Fake) => db as unknown as Parameters<typeof ensureKits>[0];

const logged: string[] = [];
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
const realFetch = globalThis.fetch; let fetched = 0;
globalThis.fetch = (async () => { fetched += 1; throw new Error("no network in this test"); }) as typeof fetch;

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = new Date("2026-11-27T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

type Opts = { email?: string; internal?: boolean; paid?: boolean | "refunded" | "test"; apps?: [string, string, boolean?][]; photos?: number; quietMin?: number; consent?: boolean; pack?: boolean };
function client(db: Fake, n: number, o: Opts = {}) {
  const email = o.email ?? `client${n}@real.org`;
  db.users.push({ id: U(n), email });
  db.tables.profiles.push({ user_id: U(n), first_name: "Sam", gender: "man", interested_in: ["woman"], voice: "playful", city: "Austin", internal: !!o.internal, updated_at: ago(o.quietMin ?? 600) });
  if (o.paid !== false) db.tables.reservations.push({ email, status: o.paid === "refunded" ? "refunded" : "paid", stripe_checkout_session_id: o.paid === "test" ? "cs_test_1" : `cs_live_${n}` });
  for (const [app, status, paused] of o.apps ?? [["hinge", "setting_up"], ["bumble", "setting_up"]]) db.tables.app_accounts.push({ user_id: U(n), app, status, user_paused: !!paused, client_action_reason: null });
  for (let i = 0; i < (o.photos ?? 6); i++) db.tables.profile_photos.push({ id: `${n}-p${i}`, user_id: U(n), position: i, path: `${n}/${i}.jpg`, deleted_at: null });
  if (o.consent) db.tables.consents.push({ user_id: U(n), version: "v1" });
  if (o.pack) db.tables.starter_packs.push({ user_id: U(n), version: 1, status: "ready", content: null });
}
const kits = (db: Fake, n: number) => db.tables.account_kits.filter((k) => k.user_id === U(n)).map((k) => k.app as string).sort();
const notes = (db: Fake, n: number) => db.tables.fulfilment_events.filter((e) => e.user_id === U(n) && e.action === "note");
const status = (db: Fake, n: number, app: string) => db.tables.app_accounts.find((a) => a.user_id === U(n) && a.app === app)!;

// the stuck client: paid, two apps, six photos, no kit, no consent -> both kits, and the consent step on their Home
{
  const db = new Fake(); client(db, 1);
  const r = await ensureKits(sb(db), U(1), NOW);
  assert.deepEqual(r, { status: "created", apps: ["hinge", "bumble"], handoff: ["hinge", "bumble"] });
  assert.deepEqual(kits(db, 1), ["bumble", "hinge"]);
  assert.equal(db.tables.account_kits[0].updated_by, "system:auto-kit");
  assert.equal(notes(db, 1).length, 2, "one note per app");
  assert.match(String(notes(db, 1)[0].note), /automatically without: starter pack/, "missing data is said in the note");
  assert.equal(status(db, 1, "hinge").status, "needs_client_action");
  assert.equal(status(db, 1, "hinge").client_action_reason, CONSENT_REASON);
  assert.ok(CONSENT_REASON.length <= 200);
  // second call, and a concurrent pair: nothing changes
  const again = await Promise.all([ensureKits(sb(db), U(1), NOW), ensureKits(sb(db), U(1), NOW)]);
  assert.ok(again.every((x) => x.status === "skipped"));
  assert.equal(db.tables.account_kits.length, 2); assert.equal(notes(db, 1).length, 2, "no duplicate note events");
  // the client confirms: the consent request is cleared, nothing else is
  db.tables.app_accounts.push({ user_id: U(1), app: "tinder", status: "needs_client_action", user_paused: false, client_action_reason: "Send a selfie" });
  assert.equal(await clearConsentRequest(sb(db), U(1)), 2);
  assert.equal(status(db, 1, "hinge").status, "setting_up");
  assert.equal(status(db, 1, "tinder").status, "needs_client_action", "an operator's request is untouched");
}

// racing first calls: both pass the "missing" check, the unique key lets one insert, one note each
{
  const db = new Fake(); client(db, 2, { consent: true });
  const both = await Promise.all([ensureKits(sb(db), U(2), NOW), ensureKits(sb(db), U(2), NOW)]);
  assert.equal(db.tables.account_kits.length, 2, "one row per app");
  assert.equal(notes(db, 2).length, 2, "one note per app even when two callers raced");
  assert.ok(both.some((x) => x.status === "created"));
  assert.equal(status(db, 2, "hinge").status, "setting_up", "consent already given: no extra step for the client");
}

// kit exists: an operator's edit survives, no regenerate, no note
{
  const db = new Fake(); client(db, 3, { apps: [["hinge", "setting_up"]], consent: true });
  db.tables.account_kits.push({ user_id: U(3), app: "hinge", sections: { bio: { text: "Edited by an operator" } }, updated_by: "ops@team.org" });
  const r = await ensureKits(sb(db), U(3), NOW);
  assert.deepEqual(r, { status: "skipped", reason: "kit_exists" });
  assert.deepEqual(db.tables.account_kits[0].sections, { bio: { text: "Edited by an operator" } });
  assert.equal(notes(db, 3).length, 0);
  // the helper itself also refuses to replace
  const g = await generateKit(sb(db), "system:auto-kit", U(3), "hinge", { onlyIfMissing: true });
  assert.deepEqual(g, { ok: true, created: false });
  assert.equal(db.tables.account_kits[0].updated_by, "ops@team.org");
  // the manual button still regenerates on purpose
  const manual = await generateKit(sb(db), "ops@team.org", U(3), "hinge");
  assert.deepEqual(manual, { ok: true, created: true });
}

// a client with one app; a kit for one app only fills the other
{
  const db = new Fake(); client(db, 4, { apps: [["hinge", "setting_up"]], consent: true });
  assert.deepEqual((await ensureKits(sb(db), U(4), NOW)), { status: "created", apps: ["hinge"], handoff: [] });
  const db2 = new Fake(); client(db2, 5, { consent: true });
  db2.tables.account_kits.push({ user_id: U(5), app: "hinge", sections: {}, updated_by: "ops@team.org" });
  assert.deepEqual((await ensureKits(sb(db2), U(5), NOW)), { status: "created", apps: ["bumble"], handoff: [] });
}

// skips
{
  const reasons: [string, Opts, string][] = [
    ["unpaid", { paid: false }, "not_paid"],
    ["refunded", { paid: "refunded" }, "not_paid"],
    ["stripe test payment", { paid: "test" }, "not_paid"],
    ["internal profile", { internal: true, paid: false }, "internal"],
    ["test address", { email: "tester.test@real.org" }, "internal"],
    ["client paused", { apps: [["hinge", "setting_up", true]] }, "paused"],
    ["team paused", { apps: [["hinge", "paused"]] }, "paused"],
    ["closed", { apps: [["hinge", "closed"]] }, "paused"],
    ["no apps", { apps: [] }, "no_apps"],
    ["mid-onboarding, no pack yet", { quietMin: 5 }, "not_ready"]
  ];
  for (const [name, o, reason] of reasons) {
    const db = new Fake(); client(db, 6, o);
    const r = await ensureKits(sb(db), U(6), NOW);
    assert.deepEqual(r, { status: "skipped", reason }, name);
    assert.equal(db.tables.account_kits.length, 0, `${name}: no kit`);
    assert.equal(db.tables.fulfilment_events.length, 0, `${name}: nothing logged`);
  }
  const ready = new Fake(); client(ready, 7, { quietMin: 5, pack: true });
  assert.equal((await ensureKits(sb(ready), U(7), NOW)).status, "created", "a ready pack does not wait for the quiet period");
  const one = new Fake(); client(one, 8, { apps: [["hinge", "setting_up"], ["bumble", "paused"]] });
  assert.deepEqual((await ensureKits(sb(one), U(8), NOW)), { status: "created", apps: ["hinge"], handoff: ["hinge"] }, "a paused app is skipped, the other is not");
  assert.deepEqual(kits(one, 8), ["hinge"]);
}

// missing photos: still generated, and the note says so
{
  const db = new Fake(); client(db, 9, { photos: 0, apps: [["hinge", "setting_up"]], consent: true });
  assert.equal((await ensureKits(sb(db), U(9), NOW)).status, "created");
  assert.match(String(notes(db, 9)[0].note), /without: starter pack, photos, preferences/);
}

// sweep: counts only, bounded, idempotent, skips the right clients
{
  const db = new Fake();
  client(db, 10); client(db, 11, { paid: false }); client(db, 12, { internal: true, paid: false }); client(db, 13, { consent: true });
  const first = await sweepKits(sb(db), { now: NOW });
  assert.equal(first.created, 2); assert.equal(first.apps, 4); assert.equal(first.skipped.not_paid, 1); assert.equal(first.skipped.internal, 1);
  assert.deepEqual(Object.keys(first).sort(), ["apps", "checked", "created", "skipped"], "counts only");
  const second = await sweepKits(sb(db), { now: NOW });
  assert.equal(second.created, 0, "idempotent");
  assert.equal(db.tables.account_kits.length, 4);
  const bounded = new Fake(); for (let i = 20; i < 25; i++) client(bounded, i);
  assert.equal((await sweepKits(sb(bounded), { limit: 2, now: NOW })).checked, 2);
}

assert.equal(fetched, 0, "nothing was sent anywhere");
const everything = JSON.stringify(logged);
assert.doesNotMatch(everything, /@real\.org|Sam|Austin/, "no personal data in logs");
globalThis.fetch = realFetch;
console.log("auto-kit checks passed");
