// Live demo mode: personas and scripts are well-formed, the date plan is stable and in the future, model output is cleaned, the cost cap
// holds, the tick chooser behaves (pacing, takeovers, one action, booking after the last line), and the migration keeps demo mode
// internal-only and server-only. No network, no database.
// Run with: node --conditions=react-server --import tsx scripts/check-demo-live.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PERSONAS, VENUES } from "../src/lib/demo/personas";
import {
  DAILY_CAP_MICRO, SEED, chooseAction, cleanLine, costMicro, fillLine, hash32, nextGapMs, personaBySlug, planDate, seedTimes, turnKind, turnSender, zonedToUtc,
  MIN_GAP_MS, MAX_GAP_MS, type ChatState
} from "../src/lib/demo/engine";
import { systemPrompt, userPrompt, writeLine } from "../src/lib/demo/llm";
import type { PackModel } from "../src/lib/starter-pack/generate";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const NOW = Date.parse("2026-11-24T21:00:00Z");

// ---------- personas ----------
{
  assert.ok(PERSONAS.length >= 12 && PERSONAS.length <= 15, "12 to 15 personas");
  assert.equal(new Set(PERSONAS.map((p) => p.slug)).size, PERSONAS.length, "unique slugs");
  assert.equal(new Set(PERSONAS.map((p) => p.name)).size, PERSONAS.length, "unique first names");
  for (const p of PERSONAS) {
    assert.ok(p.age >= 23 && p.age <= 31, `${p.slug} age`);
    assert.ok(["hinge", "tinder", "bumble"].includes(p.app));
    assert.ok(new Set(PERSONAS.map((x) => x.app)).size === 3, "all three apps appear");
    // The last three turns are always: him proposing, her saying yes, him closing; turns alternate from the opener.
    const L = p.script.length;
    assert.equal(turnKind(p, L - 3), "propose", `${p.slug} propose`);
    assert.equal(turnKind(p, L - 2), "confirm");
    assert.equal(turnKind(p, L - 1), "close");
    assert.equal(turnSender(p, L - 3), "as_user_ai", `${p.slug}: the proposal is his`);
    assert.equal(turnSender(p, L - 2), "match", `${p.slug}: she confirms`);
    assert.equal(turnSender(p, L - 1), "as_user_ai", `${p.slug}: he closes`);
    assert.ok(p.script[L - 3].includes("{day}") && p.script[L - 3].includes("{time}") && p.script[L - 3].includes("{venue}"), `${p.slug} proposal names day, time, venue`);
    assert.ok(p.script[L - 2].includes("{day}") || p.script[L - 2].includes("{time}") || p.script[L - 2].includes("{venue}") || /yes|sounds|deal|works/.test(p.script[L - 2]), `${p.slug} confirm`);
    for (const line of p.script) assert.equal(cleanLine(fillLine(line, { day: "Thursday", time: "7pm", venue: "X" }), { kind: "chat", venue: "X" }) !== null, true, `${p.slug} canned line is clean: ${line}`);
    assert.ok(!/\bai\b|noswipe|bot/i.test(p.bio + p.script.join(" ")), "no bot tells in canned text");
  }
  for (const v of VENUES) assert.ok(!/starbucks|dishoom|mcdonald|nando/i.test(v.name), "venues are invented");
  assert.ok(existsSeeds(), "seed names real personas");
  function existsSeeds() { return SEED.every((s) => personaBySlug(s.slug)); }
}

// ---------- the planned date ----------
{
  const a = planDate("11111111-aaaa-4bbb-8ccc-222222222222", NOW, "America/Los_Angeles", "London");
  const b = planDate("11111111-aaaa-4bbb-8ccc-222222222222", NOW + 5000, "America/Los_Angeles", "London");
  assert.deepEqual(a, b, "the same match always plans the same date");
  const start = Date.parse(a.startsAt);
  assert.ok(start > NOW + 36 * 3600_000 && start < NOW + 6 * 86_400_000, "2 to 5 days out");
  // The words in the chat are the date in the row, in the viewer's zone.
  const local = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long", hour: "numeric", minute: "2-digit", hourCycle: "h12" }).format(start);
  assert.ok(local.startsWith(a.day), local);
  assert.match(a.time, /^(\d{1,2})(:\d{2})?(am|pm)$/);
  assert.equal(a.address, "London city centre");
  assert.equal(planDate("x", NOW, "UTC", null).address, "Near the city centre");
  // Different matches spread over days, hours and venues.
  const plans = Array.from({ length: 40 }, (_, i) => planDate(`m-${i}`, NOW, "Europe/London", null));
  assert.ok(new Set(plans.map((p) => p.venue)).size >= 5 && new Set(plans.map((p) => p.day)).size >= 4);
  assert.ok(plans.every((p) => { const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(Date.parse(p.startsAt))); return h >= 12 && h <= 20; }), "plausible hours in the viewer's own zone");
  // Zones: wall clock round-trips, including across a DST change.
  assert.equal(new Date(zonedToUtc(2026, 11, 26, 19, 0, "America/Los_Angeles")).toISOString(), "2026-11-27T03:00:00.000Z");
  assert.equal(new Date(zonedToUtc(2026, 7, 1, 19, 0, "Europe/London")).toISOString(), "2026-07-01T18:00:00.000Z");
  assert.equal(new Date(zonedToUtc(2026, 3, 29, 12, 30, "Europe/London")).toISOString(), "2026-03-29T11:30:00.000Z", "after the spring change");
  assert.ok(hash32("a") !== hash32("b"));
}

// ---------- line hygiene ----------
{
  const ctx = { kind: "chat" as const, venue: "Fern & Co. coffee" };
  assert.equal(cleanLine('"sounds good, see you then"', ctx), "sounds good, see you then");
  assert.equal(cleanLine("Him: haha same", ctx), "haha same");
  assert.equal(cleanLine("", ctx), null);
  assert.equal(cleanLine("x".repeat(300), ctx), null);
  assert.equal(cleanLine("one\n\ntwo", ctx), null, "paragraphs are not texts");
  for (const bad of ["As an AI I can help", "i am a bot", "powered by NoSwipe", "call me 415 555 0123", "text me at me@mail.com", "check https://x.co", "@myhandle", "send nudes", "so horny", "i'll kill you"]) assert.equal(cleanLine(bad, ctx), null, bad);
  assert.equal(cleanLine("so fun 😂😂😂", ctx), null, "emoji spam");
  assert.equal(cleanLine("so fun 😂", ctx), "so fun 😂");
  assert.equal(cleanLine("thursday at 7?", { kind: "propose", venue: "Fern & Co. coffee" }), null, "a proposal must name the venue it books");
  assert.ok(cleanLine("thursday 7pm at Fern & Co. coffee?", { kind: "propose", venue: "Fern & Co. coffee" }));
}

// ---------- cost cap and the model path ----------
{
  assert.equal(DAILY_CAP_MICRO, 500_000, "$0.50 a day");
  assert.equal(costMicro(1000, 100), 1000 * 3 + 100 * 15);
  assert.equal(costMicro(-5, 0), 0);
  const p = personaBySlug("maya")!;
  const plan = planDate("m-1", NOW, "UTC", null);
  const req = { who: "him" as const, persona: p, kind: "propose" as const, plan, transcript: [{ from: "her" as const, text: "hi" }], direction: p.script[5], user: { job: "engineer", city: "London", interests: ["running"], voice: "warm" } };
  assert.ok(systemPrompt(req).includes("first person") && /never mention ai/i.test(systemPrompt(req)), "his voice, no bot tells");
  assert.ok(!systemPrompt({ ...req, who: "her" }).includes("first person"));
  assert.ok(userPrompt(req).includes(plan.venue) && userPrompt(req).includes("Conversation so far"));
  const model = (text: string, stop: string | null = "end_turn"): PackModel & { calls: number } => ({ calls: 0, async complete() { this.calls++; return { text, inputTokens: 400, outputTokens: 30, stopReason: stop }; } });
  const good = model(`how about ${plan.day} at ${plan.time}? ${plan.venue} is great`);
  const g = await writeLine(good, req);
  assert.ok(g.usedModel && g.costMicro === 400 * 3 + 30 * 15);
  const noModel = await writeLine(null, req);
  assert.equal(noModel.usedModel, false);
  assert.equal(noModel.text, fillLine(p.script[5], plan), "canned fallback is the script line");
  assert.equal((await writeLine(model("As an AI language model"), req)).usedModel, false, "bot tell falls back");
  assert.equal((await writeLine(model("whatever", "refusal"), req)).usedModel, false);
  const boom: PackModel = { async complete() { throw new Error("timeout"); } };
  assert.equal((await writeLine(boom, req)).text, fillLine(p.script[5], plan), "a model failure never breaks the chat");
}

// ---------- the tick chooser ----------
{
  const chat = (over: Partial<ChatState> = {}): ChatState => ({ matchId: "m1", slug: "maya", turns: 2, lastAtMs: NOW - 60_000, booked: false, takenOver: false, ...over });
  const base = { nowMs: NOW, chats: [chat()], usedSlugs: new Set(["maya"]), lastMatchAtMs: NOW - 10_000 };
  assert.deepEqual(chooseAction(base, seq(0)), { kind: "turn", matchId: "m1", slug: "maya", index: 2 });
  // Pacing: nothing is due right after a line, so only filler happens.
  const fresh = chooseAction({ ...base, chats: [chat({ lastAtMs: NOW - 2000 })] }, seq(0.9));
  assert.notEqual(fresh.kind, "turn");
  assert.notEqual(fresh.kind, "match", "matches are not more often than every 50 s");
  // Her lines wait longer than his.
  const maya = personaBySlug("maya")!;
  const herTurn = maya.script.findIndex((_, i) => turnSender(maya, i) === "match" && i > 0);
  assert.equal(chooseAction({ ...base, chats: [chat({ turns: herTurn, lastAtMs: NOW - 10_000 })] }, seq(0)).kind === "turn", false, "she does not reply 10 s after him");
  assert.equal(chooseAction({ ...base, chats: [chat({ turns: herTurn, lastAtMs: NOW - 20_000 })] }, seq(0)).kind, "turn");
  // A finished chat gets its date, once, ahead of everything else.
  const full = maya.script.length;
  assert.deepEqual(chooseAction({ ...base, chats: [chat({ turns: full, lastAtMs: NOW - 8000 }), chat({ matchId: "m2", slug: "priya", turns: 1 })] }, seq(0)), { kind: "book", matchId: "m1", slug: "maya" });
  assert.notEqual(chooseAction({ ...base, chats: [chat({ turns: full, booked: true, lastAtMs: NOW - 8000 })] }, seq(0)).kind, "book", "already booked");
  assert.notEqual(chooseAction({ ...base, chats: [chat({ turns: full, lastAtMs: NOW - 1000 })] }, seq(0)).kind, "book", "not before the closing line has landed");
  // Taken-over (or paused) chats are left alone.
  const kinds = new Set<string>();
  for (let i = 0; i < 40; i++) kinds.add(chooseAction({ ...base, chats: [chat({ takenOver: true })] }, () => (i + 0.5) / 40).kind);
  assert.ok(!kinds.has("turn") && !kinds.has("book"), "no AI turns in a chat the user took over");
  // New matches arrive in order, then stop when the personas run out.
  const newMatch = chooseAction({ nowMs: NOW, chats: [], usedSlugs: new Set(), lastMatchAtMs: 0 }, seq(0));
  assert.deepEqual(newMatch, { kind: "match", slug: PERSONAS[0].slug });
  const afterTwo = chooseAction({ nowMs: NOW, chats: [], usedSlugs: new Set(PERSONAS.slice(0, 2).map((p) => p.slug)), lastMatchAtMs: 0 }, seq(0));
  assert.deepEqual(afterTwo, { kind: "match", slug: PERSONAS[2].slug });
  const none = new Set(PERSONAS.map((p) => p.slug));
  for (let i = 0; i < 30; i++) assert.equal(chooseAction({ nowMs: NOW, chats: [], usedSlugs: none, lastMatchAtMs: 0 }, () => i / 30).kind, "swipes");
  // Swipe batches are plausible.
  const sw = chooseAction({ nowMs: NOW, chats: [], usedSlugs: none, lastMatchAtMs: 0 }, seq(0.5)) as { kind: "swipes"; count: number };
  assert.ok(sw.count >= 5 && sw.count <= 20);
  // The gap to the next action is random in [9 s, 26 s].
  assert.equal(nextGapMs(() => 0), MIN_GAP_MS);
  assert.equal(nextGapMs(() => 1), MAX_GAP_MS);
}

// ---------- the opening state ----------
{
  const rng = seq(0.3, 0.7, 0.5);
  for (const spec of SEED) {
    const p = personaBySlug(spec.slug)!;
    const t = seedTimes(spec, p.script.length, NOW, rng);
    const turns = spec.turns === "all" ? p.script.length : spec.turns;
    assert.equal(t.lineAtMs.length, turns);
    assert.ok(t.lineAtMs.every((v, i) => v > t.matchedAtMs && v <= NOW && (i === 0 || v > t.lineAtMs[i - 1])), `${spec.slug} lines are in order, after the match, in the past`);
  }
  assert.ok(SEED.some((s) => s.turns === "all"), "one chat starts with a booked date");
  assert.ok(SEED.some((s) => s.turns === 0), "one match starts waiting for its first message");
  assert.ok(new Set(SEED.map((s) => personaBySlug(s.slug)!.app)).size === 3, "the opening state spans all three apps");
}

// ---------- migration: internal-only and server-only ----------
{
  const sql = read("../supabase/2026-11-24-live-demo.sql");
  for (const t of ["matches", "messages", "dates", "account_activity"]) assert.match(sql, new RegExp(`alter table public\\.${t} add column if not exists demo boolean not null default false`));
  assert.match(sql, /create table if not exists public\.demo_sessions/);
  assert.match(sql, /alter table public\.demo_sessions enable row level security/);
  assert.match(sql, /revoke all on public\.demo_sessions from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.demo_sessions to service_role/);
  assert.doesNotMatch(sql, /grant [^;]*demo_sessions to (anon|authenticated)/, "no browser role can read or write demo state");
  assert.match(sql, /only available to internal accounts/);
  assert.match(sql, /profiles where user_id = new\.user_id and internal/);
  assert.doesNotMatch(sql, /drop table|truncate/i, "additive only");
  // The route and the layout both gate on profiles.internal; no client code imports the service.
  const route = read("../src/app/api/app/demo/tick/route.ts");
  assert.match(route, /\.select\("internal"\)/);
  assert.match(route, /status: 404/);
  const service = read("../src/lib/demo/service.ts");
  assert.match(service, /import "server-only"/);
  assert.doesNotMatch(service, /sendAppEmail|bookDate|notifyUser/, "demo never emails");
  assert.match(read("../src/components/app/demo-ticker.tsx"), /return null;\n\}/, "the ticker renders nothing: no demo watermark in the client UI");
}

// ---------- match profiles, source app, read state ----------
{
  const { parseMatchProfile, timeAgo, unreadCount, matchedVia } = await import("../src/lib/app/match-profile");
  const { profileFor, profileForUser, PHOTO_SUFFIXES } = await import("../src/lib/demo/profiles");
  for (const p of PERSONAS) {
    const prof = profileFor(p);
    assert.ok(parseMatchProfile(prof), `${p.slug} profile parses`);
    assert.equal(prof.photos.length, 3, "a carousel of three photos");
    assert.equal(prof.photos.length, PHOTO_SUFFIXES.length);
    if (p.app === "hinge") assert.ok(prof.prompts.length >= 3, `${p.slug}: Hinge shows prompts`);
    if (p.app === "bumble") assert.ok(prof.prompts.length === 2, `${p.slug}: Bumble shows question badges`);
    if (p.app === "tinder") assert.ok(prof.passions.length >= 4 && prof.prompts.length === 0, `${p.slug}: Tinder shows passions`);
    assert.ok(prof.distanceKm >= 1 && prof.distanceKm <= 15);
    for (const x of prof.prompts) assert.equal(cleanLine(x.a, { kind: "chat", venue: "x" }) !== null || x.a.length > 260, true, `${p.slug} prompt answer is clean`);
    assert.ok(profileForUser(p, "u1").photos.every((path) => path.startsWith("u1/demo/")), "photos live in the owner's folder so signed URLs work");
  }
  assert.equal(parseMatchProfile(null), null);
  assert.equal(parseMatchProfile({ bio: "", photos: ["a"] }), null, "no bio, no profile page");
  assert.equal(parseMatchProfile({ bio: "hi", photos: [] }), null, "no photos, no profile page");
  assert.deepEqual(parseMatchProfile({ bio: "hi", photos: ["a"], prompts: [{ q: "q", a: "" }, { q: "q2", a: "a2" }], distanceKm: 9999 })?.prompts, [{ q: "q2", a: "a2" }]);
  assert.equal(parseMatchProfile({ bio: "hi", photos: ["a"], distanceKm: 9999 })?.distanceKm, 500);
  assert.equal(timeAgo(NOW - 20_000, NOW), "just now");
  assert.equal(timeAgo(NOW - 12 * 60_000, NOW), "12 min ago");
  assert.equal(timeAgo(NOW - 3 * 3600_000, NOW), "3 h ago");
  assert.equal(timeAgo(NOW - 30 * 3600_000, NOW), "yesterday");
  assert.equal(timeAgo(NOW - 4 * 86_400_000, NOW), "4 days ago");
  assert.equal(timeAgo(NOW + 5000, NOW), "just now");
  assert.match(matchedVia("hinge"), /liked your profile/);
  const msgs = [{ sender: "match", sent_at: "2026-11-24T10:00:00Z" }, { sender: "as_user_ai", sent_at: "2026-11-24T10:01:00Z" }, { sender: "match", sent_at: "2026-11-24T10:02:00Z" }];
  assert.equal(unreadCount(msgs, "2026-11-24T10:01:30Z"), 1, "only her messages after the last open count");
  assert.equal(unreadCount(msgs, "2026-11-24T11:00:00Z"), 0);
  assert.equal(unreadCount(msgs, null), 0, "read state not tracked: no badge, so ordinary accounts are unchanged");
  // Seeds: unread chats really have her message after the read mark; older chats are complete with a past or booked date.
  assert.ok(SEED.filter((s) => s.unread).length >= 3, "several unread badges at the start");
  assert.ok(SEED.filter((s) => s.turns === "all").length >= 3 && SEED.some((s) => s.matchedAgoMin >= 3 * 1440), "older matches have full backstories");
  assert.ok(PERSONAS.length - SEED.length >= 3, "new matches keep arriving after the opening state");
  const sql2 = read("../supabase/2026-11-24-match-profiles.sql");
  assert.match(sql2, /add column if not exists profile jsonb/);
  assert.match(sql2, /add column if not exists last_read_at timestamptz/);
  assert.doesNotMatch(sql2, /grant /i, "no new grants: the owner already reads matches, only the server writes");
  // The UI: chip in Chats, thread header and Dates; a profile link only for matches that have a profile.
  assert.match(read("../src/components/app/views.tsx"), /<AppChip app=\{c\.app\} \/>/);
  assert.match(read("../src/components/app/views.tsx"), /d\.app \? <AppChip app=\{d\.app\} \/>/);
  assert.match(read("../src/components/app/thread.tsx"), /profileHref/);
  assert.match(read("../src/app/(app)/chats/[id]/page.tsx"), /chat\.profile \? `\/chats\/\$\{chat\.match\.id\}\/profile` : undefined/);
}

console.log("demo live mode checks passed");
