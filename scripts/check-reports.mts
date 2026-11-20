// Takedown process: form validation, grouping, uploads, rate limits, SLA maths and queue order (pure), then the server half
// against an in-memory Supabase stand-in: submit (anonymous, grouped, flooded, bad upload), admin actions + audit log, appeals,
// holds and their release, SLA sweep, privacy of logs, the schema file and the public copy. No network.
// Run with: node --conditions=react-server --import tsx scripts/check-reports.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACK_MS, APPEAL_SLA_MS, APPEAL_WINDOW_MS, CATEGORIES, DAY, HOUR, LIMITS, RATE, RESOLVE_MS, URGENT_MS, allowedActions, appealState, checkUpload, compareQueue, decideRate, emailsIn,
  formatAge, formatRemaining, type ReportInput, groupKey, isUrgent, newReference, opsLineBreach, opsLineNew, parseEmail, parseNcmecId, parseNote, parseReportForm, sameDeciderWarning, slaFor
} from "../src/lib/reports/core";
import { applyAction } from "../src/lib/reports/admin-actions";
import { getHoldNotice, hashIp, runSlaSweep, submitAppeal, submitReport } from "../src/lib/reports/service";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const T0 = new Date("2026-11-20T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

// ---------- form parsing ----------
const form = (o: Record<string, string>) => (name: string) => o[name] ?? null;
const good = { subjectKind: "profile", category: "scam_fraud", description: "  He asked me for money.\r\n", datingApp: "tinder", profileRef: " Jake ", email: " Me@Example.com " };
const ok = parseReportForm(form(good));
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.input.description, "He asked me for money.", "trimmed, CRLF normalised");
  assert.equal(ok.input.email, "me@example.com");
  assert.equal(ok.input.profileRef, "Jake");
  assert.equal(ok.input.honeypot, false);
  assert.equal(ok.input.inDanger, false);
}
const anon = parseReportForm(form({ ...good, email: "" }));
assert.ok(anon.ok && anon.input.email === null, "anonymous report: no email is fine");
assert.ok(!parseReportForm(form({ ...good, description: "   " })).ok, "description required");
assert.ok(!parseReportForm(form({ ...good, category: "nope" })).ok, "unknown category");
assert.ok(!parseReportForm(form({ ...good, subjectKind: "" })).ok, "subject required");
assert.ok(!parseReportForm(form({ ...good, datingApp: "grindr" })).ok, "app must be on the list");
assert.ok(!parseReportForm(form({ ...good, email: "not-an-email" })).ok, "bad email is rejected, not silently dropped");
assert.ok(!parseReportForm(form({ ...good, description: "x".repeat(LIMITS.description + 1) })).ok, "over-long description");
const noApp = parseReportForm(form({ ...good, datingApp: "", profileRef: "" }));
assert.ok(noApp.ok && noApp.input.datingApp === null && noApp.input.profileRef === null, "app and profile are optional");
const hp = parseReportForm(form({ ...good, website: "http://spam.example" }));
assert.ok(hp.ok && hp.input.honeypot, "honeypot flagged");
const ctrl = parseReportForm(form({ ...good, description: "a\u0000b\u001bc\td\ne" }));
assert.ok(ctrl.ok && ctrl.input.description === "abc\td\ne", "control characters stripped, tab and newline kept");
const danger = parseReportForm(form({ ...good, inDanger: "on" }));
assert.ok(danger.ok && danger.input.inDanger);
assert.deepEqual(parseEmail(""), { ok: true, email: null });
assert.equal(parseEmail("a@b").ok, false);
assert.equal(parseEmail("x".repeat(250) + "@example.com").ok, false, "email over 254");

// ---------- urgency ----------
assert.deepEqual(CATEGORIES.filter((c) => isUrgent(c, false)), ["minor_safety", "trafficking", "non_consensual_images", "threats"]);
assert.ok(isUrgent("scam_fraud", true), "in danger makes any report urgent");
assert.ok(!isUrgent("harassment", false));

// ---------- grouping ----------
assert.equal(groupKey("tinder", "Jane"), "tinder:jane");
assert.equal(groupKey("tinder", "@Jane"), groupKey("tinder", " jane "));
assert.equal(groupKey("tinder", "https://www.Tinder.com/@Jane/?utm=1#x"), "tinder:jane", "a link and a name group together");
assert.equal(groupKey("hinge", "jane"), "hinge:jane");
assert.notEqual(groupKey("hinge", "jane"), groupKey("tinder", "jane"));
assert.equal(groupKey("tinder", null), null);
assert.equal(groupKey(null, "jane"), "any:jane");

// ---------- reference ----------
for (let i = 0; i < 200; i++) assert.match(newReference(), /^NS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
assert.equal(newReference(() => 0), "NS-AAAA-AAAA");

// ---------- uploads ----------
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
assert.deepEqual(checkUpload(jpeg), { ok: true, type: "image/jpeg", ext: "jpg" });
assert.equal((checkUpload(png) as { type: string }).type, "image/png");
assert.equal((checkUpload(webp) as { type: string }).type, "image/webp");
assert.equal(checkUpload(new Uint8Array(0)).ok, false, "empty file");
assert.equal(checkUpload(new TextEncoder().encode("%PDF-1.7 fake.jpg")).ok, false, "a PDF renamed .jpg is rejected by its bytes");
assert.equal(checkUpload(new TextEncoder().encode("MZ\u0090\u0000 executable")).ok, false);
const big = new Uint8Array(LIMITS.upload + 1); big.set(jpeg);
assert.equal(checkUpload(big).ok, false, "over 4 MB");
const edge = new Uint8Array(LIMITS.upload); edge.set(jpeg);
assert.equal(checkUpload(edge).ok, true, "exactly 4 MB passes");

// ---------- rate limits ----------
assert.deepEqual(decideRate({ ipLastHour: 0, ipLastDay: 0, allLastHour: 0 }), { ok: true, opsLine: "line" });
assert.deepEqual(decideRate({ ipLastHour: RATE.perIpHour, ipLastDay: 3, allLastHour: 3 }), { ok: false, reason: "ip" });
assert.deepEqual(decideRate({ ipLastHour: 0, ipLastDay: RATE.perIpDay, allLastHour: 0 }), { ok: false, reason: "ip" });
assert.deepEqual(decideRate({ ipLastHour: 0, ipLastDay: 0, allLastHour: RATE.globalHour }), { ok: false, reason: "busy" });
assert.equal((decideRate({ ipLastHour: 0, ipLastDay: 0, allLastHour: RATE.opsLinesPerHour - 1 }) as { opsLine: string }).opsLine, "line");
assert.equal((decideRate({ ipLastHour: 0, ipLastDay: 0, allLastHour: RATE.opsLinesPerHour }) as { opsLine: string }).opsLine, "summary", "one summary line when the flood starts");
assert.equal((decideRate({ ipLastHour: 0, ipLastDay: 0, allLastHour: RATE.opsLinesPerHour + 5 }) as { opsLine: string }).opsLine, "none", "no further lines during a flood");

// ---------- SLA ----------
const rep = (o: Partial<Parameters<typeof slaFor>[0]> = {}) => ({ status: "new" as const, urgent: false, created_at: T0.toISOString(), ack_at: null, resolved_at: null, appealed_at: null, ...o });
const s1 = slaFor(rep(), at(2 * HOUR));
assert.equal(s1.kind, "acknowledge"); assert.equal(s1.remainingMs, ACK_MS - 2 * HOUR); assert.equal(s1.overdue, false);
assert.equal(slaFor(rep(), at(ACK_MS + 1)).overdue, true, "overdue after 24 h unacknowledged");
assert.equal(slaFor(rep(), at(ACK_MS)).overdue, false, "exactly at the deadline is not overdue yet");
assert.equal(slaFor(rep({ urgent: true }), at(URGENT_MS + 1)).overdue, true, "urgent: 4 h");
assert.equal(slaFor(rep({ urgent: true }), at(URGENT_MS - 1)).overdue, false);
assert.equal(slaFor(rep({ status: "acknowledged" }), at(RESOLVE_MS - 1)).overdue, false);
assert.equal(slaFor(rep({ status: "investigating" }), at(RESOLVE_MS + 1)).kind, "resolve");
assert.equal(slaFor(rep({ status: "investigating" }), at(RESOLVE_MS + 1)).overdue, true, "resolve within 72 h of the report");
assert.equal(slaFor(rep({ status: "actioned" }), at(10 * DAY)).kind, null, "closed reports have no clock");
assert.equal(slaFor(rep({ status: "dismissed" }), at(10 * DAY)).overdue, false);
const app = slaFor(rep({ status: "appealed", appealed_at: at(5 * DAY).toISOString() }), at(5 * DAY + APPEAL_SLA_MS - 1));
assert.equal(app.kind, "appeal"); assert.equal(app.overdue, false);
assert.equal(slaFor(rep({ status: "appealed", appealed_at: at(5 * DAY).toISOString() }), at(5 * DAY + APPEAL_SLA_MS + 1)).overdue, true, "appeal: 7 days from the appeal, not from the report");
// UTC instants: the due time is the same instant whatever the viewer's zone.
assert.equal(slaFor(rep(), T0).dueAt?.toISOString(), "2026-11-21T12:00:00.000Z");
assert.equal(slaFor(rep({ urgent: true }), T0).dueAt?.toISOString(), "2026-11-20T16:00:00.000Z");
assert.equal(slaFor(rep({ created_at: "garbage" }), T0).kind, null, "an unreadable date never crashes");
assert.equal(formatRemaining(3 * HOUR + 10 * 60_000), "3h 10m left");
assert.equal(formatRemaining(-(5 * HOUR + 2 * 60_000)), "overdue 5h 2m");
assert.equal(formatRemaining(2 * DAY + HOUR), "2d 1h left");
assert.equal(formatAge(26 * HOUR), "1d 2h");

// queue order: open+urgent first, then overdue, then nearest deadline; closed last newest first
const q = (id: string, o: Partial<Parameters<typeof slaFor>[0]> = {}) => ({ id, ...rep(o) });
const rows = [
  q("closed-old", { status: "dismissed", created_at: at(-9 * DAY).toISOString() }),
  q("plain-fresh", { created_at: at(-1 * HOUR).toISOString() }),
  q("plain-overdue", { created_at: at(-30 * HOUR).toISOString() }),
  q("urgent-fresh", { urgent: true, created_at: at(-10 * 60_000).toISOString() }),
  q("urgent-overdue", { urgent: true, created_at: at(-6 * HOUR).toISOString() }),
  q("closed-new", { status: "actioned", created_at: at(-2 * DAY).toISOString() }),
  q("plain-resolve", { status: "investigating", created_at: at(-60 * HOUR).toISOString() })
];
assert.deepEqual([...rows].sort((a, b) => compareQueue(a, b, T0)).map((r) => r.id),
  ["urgent-overdue", "urgent-fresh", "plain-overdue", "plain-resolve", "plain-fresh", "closed-new", "closed-old"]);

// ---------- appeals, deciders, misc ----------
const decided = { status: "actioned" as const, appeal_outcome: null, appealed_at: null };
assert.equal(appealState(decided, T0.toISOString(), at(13 * DAY)).kind, "can_appeal");
assert.equal(appealState(decided, T0.toISOString(), at(APPEAL_WINDOW_MS)).kind, "can_appeal", "the 14th day still counts");
assert.equal(appealState(decided, T0.toISOString(), at(APPEAL_WINDOW_MS + 1)).kind, "expired");
assert.equal(appealState({ ...decided, status: "appealed" }, T0.toISOString(), at(DAY)).kind, "submitted");
assert.equal(appealState({ ...decided, appeal_outcome: "upheld" }, T0.toISOString(), at(DAY)).kind, "decided", "one appeal only");
assert.equal(sameDeciderWarning("A@x.com", "a@X.com"), true);
assert.equal(sameDeciderWarning("a@x.com", "b@x.com"), false);
assert.equal(sameDeciderWarning(null, "b@x.com"), false);
assert.equal(parseNote("  ").ok, false); assert.equal(parseNote("ok").ok, false); assert.equal(parseNote("seen it").ok, true);
assert.equal(parseNcmecId("12345678").ok, true); assert.equal(parseNcmecId("x").ok, false); assert.equal(parseNcmecId("<script>").ok, false);
assert.deepEqual(emailsIn("mail Jake@Example.com or jake@example.com now"), ["jake@example.com"]);

assert.deepEqual(allowedActions({ status: "new", category: "scam_fraud", matched: false }), ["acknowledge", "investigate", "link_client", "unlink_client", "mark_actioned", "dismiss"], "a non-client report cannot pause, close or remove photos");
assert.ok(allowedActions({ status: "new", category: "scam_fraud", matched: true }).includes("pause_client"));
assert.ok(!allowedActions({ status: "new", category: "scam_fraud", matched: true }).includes("record_ncmec"), "NCMEC panel only for minor safety");
assert.ok(allowedActions({ status: "new", category: "minor_safety", matched: false }).includes("record_ncmec"));
assert.deepEqual(allowedActions({ status: "appealed", category: "harassment", matched: true }), ["appeal_uphold", "appeal_overturn"]);
assert.ok(!allowedActions({ status: "dismissed", category: "harassment", matched: true }).includes("pause_client"));

// ops lines carry no description, email or name
const line = opsLineNew({ ref: "NS-ABCD-EFGH", category: "minor_safety", urgent: true, datingApp: "tinder", related: 2 }, "https://noswipe.app/admin/reports/1");
assert.match(line, /^URGENT New report NS-ABCD-EFGH: Minor safety/); assert.match(line, /#3 on the same profile/);
assert.equal(line.split("\n").length, 2, "one line plus the link");
assert.match(opsLineBreach({ ref: "NS-ABCD-EFGH", category: "threats", urgent: true }, slaFor(rep({ urgent: true }), at(5 * HOUR)), "https://x/y"), /URGENT SLA breach NS-ABCD-EFGH: acknowledgement overdue 1h 0m/);

// ---------- in-memory Supabase ----------
type Row = Record<string, unknown>;
class Fake {
  tables: Record<string, Row[]> = { reports: [], reports_events: [], profiles: [], app_accounts: [], profile_photos: [], photo_flags: [] };
  files = new Map<string, Uint8Array>();
  failInsert = new Set<string>();
  errors: string[] = [];
  seq = 0;
  from(table: string) { return new Q(this, table); }
  storage = { from: (bucket: string) => ({
    upload: async (path: string, bytes: Uint8Array) => { this.files.set(`${bucket}/${path}`, bytes); return { error: null }; },
    remove: async (paths: string[]) => { for (const p of paths) this.files.delete(`${bucket}/${p}`); return { error: null }; },
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null }),
    createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null })
  }) };
  auth = { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: `${id.slice(0, 4)}@example.com` } } }), listUsers: async () => ({ data: { users: [] }, error: null }) } };
}
class Q implements PromiseLike<{ data: unknown; error: { code: string } | null; count?: number }> {
  private f: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private head = false; private wantCount = false; private lim = Infinity; private ord: [string, boolean] | null = null; private returning = false;
  constructor(private db: Fake, private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { if (this.op === "select") { this.wantCount = !!opts?.count; this.head = !!opts?.head; } else this.returning = true; return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  eq(c: string, v: unknown) { this.f.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.f.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.f.push((r) => v.includes(r[c])); return this; }
  gte(c: string, v: string) { this.f.push((r) => r[c] != null && String(r[c]) >= v); return this; }
  is(c: string, v: null) { this.f.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string) { this.f.push((r) => r[c] != null); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord = [c, o?.ascending !== false]; return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { return this.run(true); }
  single() { return this.run(true, true); }
  then<A, B>(a?: ((v: { data: unknown; error: { code: string } | null; count?: number }) => A | PromiseLike<A>) | null, b?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run(false).then(a, b); }
  private async run(single: boolean, strict = false) {
    const rows = this.db.tables[this.table];
    if (!rows) return { data: null, error: { code: "42P01" } };
    const match = rows.filter((r) => this.f.every((t) => t(r)));
    if (this.op === "insert") {
      if (this.db.failInsert.has(this.table)) return { data: null, error: { code: "XX000" } };
      const made: Row[] = [];
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
        const row: Row = { id: `00000000-0000-4000-8000-${String(++this.db.seq).padStart(12, "0")}`, at: new Date().toISOString(), ...p };
        if (this.table === "reports" && rows.some((r) => r.ref === row.ref)) return { data: null, error: { code: "23505" } };
        rows.push(row); made.push(row);
      }
      return single ? { data: made[0], error: null } : { data: made, error: null };
    }
    if (this.op === "update") {
      for (const r of match) Object.assign(r, this.payload);
      return { data: this.returning ? match.map((r) => ({ id: r.id })) : null, error: null };
    }
    let out = [...match];
    if (this.ord) { const [c, asc] = this.ord; out.sort((a, b) => (String(a[c]) > String(b[c]) ? 1 : -1) * (asc ? 1 : -1)); }
    out = out.slice(0, this.lim).map((r) => structuredClone(r));
    if (this.head) return { data: null, error: null, count: match.length };
    if (single) { if (strict && out.length !== 1) return { data: null, error: { code: "PGRST116" } }; return { data: out[0] ?? null, error: null }; }
    return { data: out, error: null, ...(this.wantCount ? { count: match.length } : {}) };
  }
}
const mk = () => new Fake();
const sbOf = (f: Fake) => f as unknown as Parameters<typeof submitReport>[4];
const base: ReportInput = { email: null, subjectKind: "profile", datingApp: "tinder", profileRef: "Jake", description: "Asked for money", category: "scam_fraud", inDanger: false, honeypot: false };

// logs must never carry report content: capture console.error for the whole run
const logged: string[] = [];
const origError = console.error;
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };

// ---------- submit ----------
{
  const db = mk();
  const ip = "203.0.113.7";
  const r1 = await submitReport({ ...base, description: "SECRET-DESCRIPTION", email: "reporter@example.com" }, null, hashIp(ip), T0, sbOf(db));
  assert.ok(r1.ok); assert.match((r1 as { ref: string }).ref, /^NS-/);
  const row = db.tables.reports[0];
  assert.equal(row.status, "new"); assert.equal(row.urgent, false); assert.equal(row.reporter_email, "reporter@example.com");
  assert.ok(!JSON.stringify(db.tables).includes(ip), "the IP address is never stored, only a keyed hash");
  assert.equal(row.ip_hash, hashIp(ip)); assert.notEqual(hashIp(ip), hashIp("203.0.113.8"));
  assert.equal(db.tables.reports_events.length, 1, "creation is in the audit log");
  assert.equal(db.tables.reports_events[0].actor, "reporter");

  // anonymous
  const r2 = await submitReport({ ...base, profileRef: "other", email: null }, null, hashIp("198.51.100.1"), T0, sbOf(db));
  assert.ok(r2.ok); assert.equal(db.tables.reports[1].reporter_email, null);
  assert.deepEqual(db.tables.reports_events[1].detail, { anonymous: true, attachment: false, related: 0 });

  // urgent by category and by "in danger"
  await submitReport({ ...base, category: "minor_safety", profileRef: "a" }, null, hashIp("198.51.100.2"), T0, sbOf(db));
  await submitReport({ ...base, category: "other", inDanger: true, profileRef: "b" }, null, hashIp("198.51.100.3"), T0, sbOf(db));
  assert.deepEqual(db.tables.reports.slice(2).map((r) => r.urgent), [true, true]);

  // duplicate reports on the same profile are kept and grouped (link and name collapse to one key)
  const d1 = await submitReport({ ...base, profileRef: "https://tinder.com/@Jake" }, null, hashIp("198.51.100.4"), T0, sbOf(db));
  assert.ok(d1.ok);
  const same = db.tables.reports.filter((r) => r.group_key === "tinder:jake");
  assert.equal(same.length, 2, "two reports, one group");
  assert.equal(db.tables.reports_events.at(-1)!.detail && (db.tables.reports_events.at(-1)!.detail as { related: number }).related, 1);

  // a report about a non-client simply has no matched user
  assert.equal(db.tables.reports.every((r) => r.matched_user_id == null), true);
}
{
  // flood from one address: 3 per hour, then refused; other addresses unaffected
  const db = mk();
  const h = hashIp("192.0.2.1");
  for (let i = 0; i < RATE.perIpHour; i++) assert.ok((await submitReport({ ...base, profileRef: `p${i}` }, null, h, T0, sbOf(db))).ok);
  const blocked = await submitReport(base, null, h, T0, sbOf(db));
  assert.ok(!blocked.ok && blocked.code === "rate");
  assert.equal(db.tables.reports.length, RATE.perIpHour, "a refused report stores nothing");
  assert.ok((await submitReport(base, null, hashIp("192.0.2.2"), T0, sbOf(db))).ok, "another address is fine");
  assert.ok((await submitReport(base, null, h, at(HOUR + 1), sbOf(db))).ok, "the hour window slides");
  // 10 per day cap across hours
  const db2 = mk();
  for (let i = 0; i < RATE.perIpDay; i++) await submitReport({ ...base, profileRef: `d${i}` }, null, h, at(i * 70 * 60_000 % (20 * HOUR)), sbOf(db2));
  const dayBlocked = await submitReport(base, null, h, at(21 * HOUR), sbOf(db2));
  assert.ok(!dayBlocked.ok && dayBlocked.code === "rate", "daily cap");
  // unknown address: no per-address bucket, the global guard still holds
  const db3 = mk();
  for (let i = 0; i < RATE.globalHour; i++) db3.tables.reports.push({ id: `x${i}`, created_at: T0.toISOString(), ip_hash: `h${i}` });
  const busy = await submitReport(base, null, null, T0, sbOf(db3));
  assert.ok(!busy.ok && busy.code === "busy", "global flood guard");
}
{
  // uploads
  const db = mk();
  const bad = await submitReport(base, new TextEncoder().encode("%PDF-1.4"), hashIp("1"), T0, sbOf(db));
  assert.ok(!bad.ok && bad.code === "upload"); assert.equal(db.tables.reports.length, 0); assert.equal(db.files.size, 0);
  const tooBig = new Uint8Array(LIMITS.upload + 1); tooBig.set(jpeg);
  const huge = await submitReport(base, tooBig, hashIp("1"), T0, sbOf(db));
  assert.ok(!huge.ok && huge.code === "upload" && db.files.size === 0);
  const good = await submitReport(base, jpeg, hashIp("1"), T0, sbOf(db));
  assert.ok(good.ok); assert.equal(db.files.size, 1);
  const [key] = [...db.files.keys()];
  assert.match(key, /^report-uploads\/NS-[A-Z0-9]{4}-[A-Z0-9]{4}\/[0-9a-f-]{36}\.jpg$/, "private bucket, folder per reference, random name");
  assert.equal(db.tables.reports[0].attachment_path, key.replace("report-uploads/", ""));
  // a failed insert removes the file again
  db.failInsert.add("reports");
  const failed = await submitReport(base, jpeg, hashIp("2"), T0, sbOf(db));
  assert.ok(!failed.ok && db.files.size === 1, "no orphaned image after a failed insert");
  // migration not applied: a clear "email us", nothing thrown
  const bare = new Fake(); bare.tables = {};
  const none = await submitReport(base, null, hashIp("3"), T0, sbOf(bare));
  assert.ok(!none.ok && none.code === "unavailable" && /support@noswipe\.app/.test(none.error));
}

// ---------- admin actions, holds, appeals ----------
const U = "11111111-1111-4111-8111-111111111111";
const ADMIN_A = "a@noswipe.app", ADMIN_B = "b@noswipe.app";
function world() {
  const db = mk();
  db.tables.profiles.push({ user_id: U, first_name: "Jake", report_hold: null, report_hold_report_id: null, report_hold_at: null });
  db.tables.app_accounts.push({ user_id: U, app: "tinder", status: "live" }, { user_id: U, app: "hinge", status: "setting_up" });
  db.tables.profile_photos.push({ id: "22222222-2222-4222-8222-222222222222", user_id: U, path: `${U}/p.jpg`, deleted_at: null });
  return db;
}
async function newReport(db: Fake, o: Partial<typeof base> = {}) {
  const r = await submitReport({ ...base, ...o }, null, hashIp(String(Math.random())), T0, sbOf(db));
  assert.ok(r.ok);
  return db.tables.reports.at(-1)!.id as string;
}
const act = (db: Fake, admin: string, id: string, a: Parameters<typeof applyAction>[3], p: Parameters<typeof applyAction>[4], when = T0) => applyAction(sbOf(db)!, admin, id, a, p, when);
const events = (db: Fake, id: string) => db.tables.reports_events.filter((e) => e.report_id === id);

{
  const db = world();
  const id = await newReport(db);
  // note is required for every action
  assert.ok(!(await act(db, ADMIN_A, id, "acknowledge", { note: " " })).ok);
  assert.equal(db.tables.reports[0].status, "new");
  // acknowledge, logged with email and time
  assert.ok((await act(db, ADMIN_A, id, "acknowledge", { note: "Reading it now" }, at(HOUR))).ok);
  const r = db.tables.reports[0];
  assert.equal(r.status, "acknowledged"); assert.equal(r.ack_by, ADMIN_A); assert.equal(r.ack_at, at(HOUR).toISOString());
  const ev = events(db, id).at(-1)!;
  assert.equal(ev.actor, ADMIN_A); assert.equal(ev.action, "acknowledge"); assert.equal(ev.note, "Reading it now"); assert.deepEqual(ev.detail, { from: "new", to: "acknowledged" });
  // double submit: the same action again is refused, not applied twice
  const again = await act(db, ADMIN_A, id, "acknowledge", { note: "again" });
  assert.ok(!again.ok);
  // a stale page (status changed meanwhile) is refused by the status guard
  const stale = await applyAction(sbOf(db)!, ADMIN_B, id, "investigate", { note: "x1y2" }, T0);
  assert.ok(stale.ok);
  // pause needs a linked client
  const noClient = await act(db, ADMIN_A, id, "pause_client", { note: "pausing" });
  assert.ok(!noClient.ok && /linked client/.test(noClient.error));
  // link, then pause: every app paused, snapshot kept, hold set
  assert.ok(!(await act(db, ADMIN_A, id, "link_client", { note: "same name", userId: "nope" })).ok);
  assert.ok(!(await act(db, ADMIN_A, id, "link_client", { note: "same name", userId: "99999999-9999-4999-8999-999999999999" })).ok, "linking an unknown client fails");
  assert.ok((await act(db, ADMIN_A, id, "link_client", { note: "same name and app", userId: U })).ok);
  assert.equal(db.tables.reports[0].matched_user_id, U);
  assert.ok((await act(db, ADMIN_A, id, "pause_client", { note: "pausing pending review" }, at(2 * HOUR))).ok);
  assert.deepEqual(db.tables.app_accounts.map((a) => a.status), ["paused", "paused"]);
  assert.deepEqual(db.tables.reports[0].pause_snapshot, { tinder: "live", hinge: "setting_up" });
  assert.equal(db.tables.profiles[0].report_hold, "paused"); assert.equal(db.tables.profiles[0].report_hold_report_id, id);
  assert.equal(db.tables.reports[0].status, "investigating"); assert.equal(db.tables.reports[0].decided_by, ADMIN_A);
  // the user's notice
  const notice = await getHoldNotice(U, at(3 * HOUR), sbOf(db)!);
  assert.equal(notice?.hold, "paused"); assert.equal(notice?.ref, db.tables.reports[0].ref); assert.equal(notice?.appeal.kind, "can_appeal");
  // close account (soft): snapshot of the paused apps would be wrong, so the first snapshot is kept
  assert.ok((await act(db, ADMIN_A, id, "close_account", { note: "confirmed scam" }, at(4 * HOUR))).ok);
  assert.equal(db.tables.profiles[0].report_hold, "closed");
  assert.deepEqual(db.tables.reports[0].pause_snapshot, { tinder: "live", hinge: "setting_up" }, "re-pausing never overwrites the state to restore");
  assert.equal(db.tables.reports[0].status, "actioned");
  assert.equal(db.tables.reports[0].resolved_at, at(4 * HOUR).toISOString());
  // appeal: needs 10+ chars, works once, within 14 days
  assert.ok(!(await submitAppeal(U, "short", at(5 * HOUR), sbOf(db)!)).ok);
  assert.ok(!(await submitAppeal("33333333-3333-4333-8333-333333333333", "I did nothing wrong at all", at(5 * HOUR), sbOf(db)!)).ok, "a user with no hold has nothing to appeal");
  const ap = await submitAppeal(U, "This was a different Jake, please check.", at(5 * HOUR), sbOf(db)!);
  assert.ok(ap.ok);
  assert.equal(db.tables.reports[0].status, "appealed"); assert.equal(db.tables.reports[0].appealed_at, at(5 * HOUR).toISOString());
  assert.equal(events(db, id).at(-1)!.actor, "user");
  assert.ok(!(await submitAppeal(U, "Second attempt at appealing it", at(6 * HOUR), sbOf(db)!)).ok, "one appeal only");
  assert.equal((await getHoldNotice(U, at(6 * HOUR), sbOf(db)!))?.appeal.kind, "submitted");
  // same admin as the original decision: allowed, warned, and recorded
  const same = await act(db, ADMIN_A, id, "appeal_overturn", { note: "second look: wrong person" }, at(DAY));
  assert.ok(same.ok && same.warning && /different admin/i.test(same.warning));
  assert.deepEqual((events(db, id).at(-1)!.detail as { sameAdminAsOriginalDecision: boolean }).sameAdminAsOriginalDecision, true);
  // overturned: apps restored to what they were, hold gone
  assert.deepEqual(db.tables.app_accounts.map((a) => a.status), ["live", "setting_up"]);
  assert.equal(db.tables.profiles[0].report_hold, null); assert.equal(db.tables.reports[0].status, "dismissed"); assert.equal(db.tables.reports[0].appeal_outcome, "overturned");
  assert.equal(await getHoldNotice(U, at(2 * DAY), sbOf(db)!), null);
  // every action above is in the log with an actor
  assert.ok(events(db, id).every((e) => typeof e.actor === "string" && e.actor.length > 0));
  assert.deepEqual(events(db, id).map((e) => e.action), ["created", "acknowledge", "investigate", "link_client", "pause_client", "close_account", "appealed", "appeal_overturned"]);
}
{
  // different admin upholds: no warning; hold stays; second appeal impossible
  const db = world();
  const id = await newReport(db);
  await act(db, ADMIN_A, id, "link_client", { note: "matched", userId: U });
  await act(db, ADMIN_A, id, "close_account", { note: "closing" });
  await submitAppeal(U, "I am not who they think I am", at(DAY), sbOf(db)!);
  const up = await act(db, ADMIN_B, id, "appeal_uphold", { note: "evidence is clear" }, at(2 * DAY));
  assert.ok(up.ok && !up.warning);
  assert.equal(db.tables.reports[0].status, "actioned"); assert.equal(db.tables.profiles[0].report_hold, "closed");
  assert.equal((await getHoldNotice(U, at(3 * DAY), sbOf(db)!))?.appeal.kind, "decided");
  assert.ok(!(await submitAppeal(U, "Trying a second appeal here", at(3 * DAY), sbOf(db)!)).ok);
}
{
  // closed account: appeal after the 14-day window is refused
  const db = world();
  const id = await newReport(db);
  await act(db, ADMIN_A, id, "link_client", { note: "matched", userId: U });
  await act(db, ADMIN_A, id, "close_account", { note: "closing" }, T0);
  assert.equal((await getHoldNotice(U, at(14 * DAY), sbOf(db)!))?.appeal.kind, "can_appeal");
  const late = await submitAppeal(U, "I only saw this notice now", at(14 * DAY + HOUR), sbOf(db)!);
  assert.ok(!late.ok && /14-day/.test(late.error));
  assert.equal(db.tables.reports[0].status, "actioned");
}
{
  // remove photo reuses photo_flags remove; dismiss lifts a pause; unknown photo refused
  const db = world();
  const id = await newReport(db, { category: "non_consensual_images" });
  await act(db, ADMIN_A, id, "link_client", { note: "matched", userId: U });
  assert.ok(!(await act(db, ADMIN_A, id, "remove_photo", { note: "removing", photoId: "44444444-4444-4444-8444-444444444444" })).ok);
  assert.ok((await act(db, ADMIN_A, id, "remove_photo", { note: "removing the photo", photoId: "22222222-2222-4222-8222-222222222222" }, at(HOUR))).ok);
  assert.ok(db.tables.profile_photos[0].deleted_at, "soft-deleted"); assert.equal(db.tables.photo_flags[0].status, "removed");
  assert.equal(db.tables.reports[0].status, "actioned");
  const id2 = await newReport(db, { profileRef: "Jake2" });
  await act(db, ADMIN_A, id2, "link_client", { note: "matched", userId: U });
  await act(db, ADMIN_A, id2, "pause_client", { note: "pausing" });
  assert.equal(db.tables.profiles[0].report_hold, "paused");
  assert.ok((await act(db, ADMIN_B, id2, "dismiss", { note: "false report" })).ok);
  assert.equal(db.tables.profiles[0].report_hold, null, "dismissing lifts the hold the report put on");
  assert.deepEqual(db.tables.app_accounts.map((a) => a.status), ["live", "setting_up"]);
  // a later report's hold is not lifted by dismissing an earlier one
  const id3 = await newReport(db, { profileRef: "Jake3" });
  const id4 = await newReport(db, { profileRef: "Jake4" });
  for (const x of [id3, id4]) await act(db, ADMIN_A, x, "link_client", { note: "matched", userId: U });
  await act(db, ADMIN_A, id3, "pause_client", { note: "first pause" });
  await act(db, ADMIN_A, id4, "pause_client", { note: "second pause" });
  await act(db, ADMIN_B, id3, "dismiss", { note: "no basis" });
  assert.equal(db.tables.profiles[0].report_hold, "paused", "the newer report still holds the account");
  await act(db, ADMIN_B, id4, "dismiss", { note: "no basis either" });
  assert.equal(db.tables.profiles[0].report_hold, null);
  assert.deepEqual(db.tables.app_accounts.map((a) => a.status), ["live", "setting_up"], "restored to the state before the first hold, not to paused");
}
{
  // NCMEC: only minor_safety, id required, recorded with who and when; never automatic
  const db = world();
  const id = await newReport(db, { category: "minor_safety" });
  assert.ok(!(await act(db, ADMIN_A, id, "record_ncmec", { note: "filed", ncmecId: "" })).ok);
  assert.ok((await act(db, ADMIN_A, id, "record_ncmec", { note: "filed via CyberTipline", ncmecId: "CT-12345678" }, at(HOUR))).ok);
  assert.equal(db.tables.reports[0].ncmec_report_id, "CT-12345678"); assert.equal(db.tables.reports[0].ncmec_filed_by, ADMIN_A);
  assert.equal(events(db, id).at(-1)!.action, "ncmec_recorded");
  const other = await newReport(db, { category: "scam_fraud", profileRef: "z" });
  assert.ok(!(await act(db, ADMIN_A, other, "record_ncmec", { note: "filed", ncmecId: "CT-12345678" })).ok, "not offered for other categories");
}
{
  // report about a non-client: can be acknowledged and marked actioned, never account actions
  const db = world();
  const id = await newReport(db, { profileRef: "Stranger" });
  assert.ok(!(await act(db, ADMIN_A, id, "close_account", { note: "closing" })).ok);
  assert.ok((await act(db, ADMIN_A, id, "mark_actioned", { note: "reported to the other platform" })).ok);
  assert.equal(db.tables.reports[0].status, "actioned");
}
{
  // SLA sweep: one alert per breach, even when swept repeatedly
  const db = world();
  const urgent = await newReport(db, { category: "threats" });
  const plain = await newReport(db, { profileRef: "p" });
  assert.deepEqual(await runSlaSweep(sbOf(db)!, at(HOUR)), { checked: 2, alerted: 0 });
  assert.equal((await runSlaSweep(sbOf(db)!, at(5 * HOUR))).alerted, 1, "urgent breach at 4 h");
  assert.equal((await runSlaSweep(sbOf(db)!, at(6 * HOUR))).alerted, 0, "announced once");
  assert.equal((await runSlaSweep(sbOf(db)!, at(25 * HOUR))).alerted, 1, "the plain report breaches at 24 h");
  await act(db, ADMIN_A, plain, "acknowledge", { note: "on it" }, at(26 * HOUR));
  assert.equal((await runSlaSweep(sbOf(db)!, at(75 * HOUR))).alerted, 1, "the acknowledged report breaches its 72 h resolution (the never-acknowledged urgent one was announced already)");
  assert.equal((await runSlaSweep(sbOf(db)!, at(80 * HOUR))).alerted, 0);
  void urgent;
}

// ---------- privacy: nothing the reporter wrote reaches a log ----------
console.error = origError;
assert.ok(logged.every((l) => !/SECRET-DESCRIPTION|reporter@example\.com|203\.0\.113/.test(l)), "no report text, email or address in logs");
for (const file of ["../src/lib/reports/service.ts", "../src/lib/reports/admin-actions.ts", "../src/app/api/report/route.ts", "../src/lib/reports/actions.ts"]) {
  for (const l of read(file).split("\n").filter((x) => /console\.(log|error|warn|info)/.test(x))) {
    assert.ok(!/description|reporter_email|profile_ref|appeal_text|\bemail\b|\bnote\b|\bbody\b|formData|input\b/.test(l), `${file}: log line must not include report content: ${l.trim()}`);
  }
}

// ---------- schema + wiring + copy ----------
const sql = read("../supabase/2026-11-20-reports.sql");
for (const t of ["reports", "reports_events"]) {
  assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  assert.match(sql, new RegExp(`revoke all on public\\.${t} from public, anon, authenticated`));
  assert.match(sql, new RegExp(`grant [a-z, ]+ on public\\.${t} to service_role`));
}
assert.ok(!/create policy[^;]*public\.reports/i.test(sql), "no browser policy on reports");
assert.ok(!/create policy[^;]*report-uploads/i.test(sql), "no storage policy for the upload bucket: service role only");
assert.match(sql, /'report-uploads', 'report-uploads', false, 4194304/);
assert.ok(!/drop table|drop column|truncate|delete from/i.test(sql), "additive only");
assert.ok(/create table if not exists/i.test(sql) && /add column if not exists/i.test(sql));
for (const c of CATEGORIES) assert.ok(sql.includes(`'${c}'`), `category ${c} is in the check constraint`);
assert.match(sql, /'new', 'acknowledged', 'investigating', 'actioned', 'dismissed', 'appealed'/);

const pages = { contact: read("../src/app/contact/page.tsx"), au: read("../src/app/acceptable-use/page.tsx"), le: read("../src/app/law-enforcement/page.tsx"), footer: read("../src/components/site-footer.tsx") };
for (const [name, src] of Object.entries(pages)) assert.match(src, /href="\/report"/, `${name} links to /report`);
for (const src of [pages.contact, pages.au]) { assert.match(src, /24 hours/); assert.match(src, /72 hours/); assert.match(src, /14 days/); assert.match(src, /7 days/); }
assert.match(pages.au, /4 hour/);
const reportPage = read("../src/app/report/report-form.tsx");
assert.ok(!/recaptcha|hcaptcha|turnstile|friendlycaptcha/i.test(reportPage + read("../src/app/api/report/route.ts")), "no CAPTCHA service");
assert.match(reportPage, /disabled=\{pending\}/, "the submit button disables while in flight");
assert.match(reportPage, /name="website"[^>]*tabIndex=\{-1\}/, "honeypot is out of the tab order");
assert.match(read("../src/app/admin/_components/admin-nav.tsx"), /\/admin\/reports/);
for (const f of ["../src/app/admin/reports/page.tsx", "../src/app/admin/reports/[id]/page.tsx"]) assert.match(read(f), /requireAdminPage\(\)/, `${f} checks the admin itself`);
assert.match(read("../src/app/admin/reports/actions.ts"), /adminEmailOrNull\(\)/);
assert.match(read("../src/app/api/cron/report-sla/route.ts"), /CRON_SECRET/);
assert.ok(!/NEXT_PUBLIC_/.test(read("../src/lib/reports/service.ts") + read("../src/lib/ops-notify.ts")), "no secret in a public env var");

console.log("check-reports: ok");
