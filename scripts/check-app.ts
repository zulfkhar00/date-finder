// Checks for the NoSwipe app: takeover/pause rules, validation, calendar export, email content,
// and static checks on the migration (RLS on, browser roles revoked, owner-only policies).
// No network, no database. The live RLS test is supabase/tests/app-rls.sql (scripts/run-app-rls-test.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDateBookedEmail, buildLoginEmail, buildNeedsYouEmail } from "../src/lib/app-emails";
import { buildDemo } from "../src/lib/app/demo-data";
import {
  MODE_LABELS, SENT_BY_TAG, encodeSystemEvent, parseSystemEvent, systemEventText,
  APPS, CONSENT_STATEMENT, ageFromBirthday, bubbleSide, buildIcs, canAiSend, canUserSend, chatMode, effectiveStatus, initials, stepSchemas
} from "../src/lib/app/domain";

// --- takeover state --------------------------------------------------------------------------
assert.equal(chatMode([]), "ai", "no takeovers: AI chats");
assert.equal(chatMode([{ ended_at: "2026-11-04T10:00:00Z" }]), "ai", "an ended takeover is over");
assert.equal(chatMode([{ ended_at: "2026-11-04T10:00:00Z" }, { ended_at: null }]), "user", "an open takeover wins");
assert.deepEqual(canAiSend("ai", "live"), { ok: true });
assert.deepEqual(canAiSend("ai", "setting_up"), { ok: true });
assert.deepEqual(canAiSend("user", "live"), { ok: false, reason: "taken_over" }, "AI is blocked during a takeover");
assert.deepEqual(canAiSend("ai", "paused"), { ok: false, reason: "app_paused" }, "AI is blocked while the app is paused");
assert.deepEqual(canAiSend("user", "paused"), { ok: false, reason: "taken_over" }, "takeover is reported first");
assert.deepEqual(canUserSend("user"), { ok: true });
assert.deepEqual(canUserSend("ai"), { ok: false, reason: "no_takeover" }, "the user types only after taking over");
assert.equal(effectiveStatus({ status: "live", user_paused: true }), "paused", "the user's pause wins");
assert.equal(effectiveStatus({ status: "setting_up", user_paused: false }), "setting_up");
assert.equal(bubbleSide("match"), "them");
assert.equal(bubbleSide("as_user_ai"), "me", "AI-written messages read as the user's own");
assert.equal(bubbleSide("user"), "me");
assert.equal(bubbleSide("system_internal"), "system", "internal notices are their own row style");

// --- internal notices: in the user's thread only ----------------------------------------------
const bookedEvent = encodeSystemEvent({ kind: "date_booked", startsAt: "2027-01-14T19:00:00Z", venue: "Taco place on 5th" });
assert.deepEqual(parseSystemEvent(bookedEvent), { kind: "date_booked", startsAt: "2027-01-14T19:00:00Z", venue: "Taco place on 5th" });
assert.deepEqual(parseSystemEvent(encodeSystemEvent({ kind: "took_over" })), { kind: "took_over" });
assert.equal(parseSystemEvent("not json"), null);
assert.equal(parseSystemEvent('{"kind":"other"}'), null);
assert.equal(systemEventText({ kind: "took_over" }, () => ""), "You took over");
assert.equal(systemEventText({ kind: "handed_back" }, () => ""), "Handed back");
assert.equal(systemEventText({ kind: "date_booked", startsAt: "x", venue: "Taco place on 5th" }, () => "Thu 7:00 pm"), "📅 Date booked · Thu 7:00 pm · Taco place on 5th");
assert.equal(SENT_BY_TAG, "Sent by NoSwipe");
assert.equal(MODE_LABELS.ai, "NoSwipe is chatting");

// --- demo content: matches only ever see ordinary texting from the user ------------------------
const demo = buildDemo(Date.parse("2026-11-04T12:00:00Z"));
for (const chat of demo.chats) {
  for (const m of chat.messages.filter((x) => x.sender === "as_user_ai" || x.sender === "user")) {
    assert.doesNotMatch(m.body, /\b(ai|a\.i\.|bot|bots|robot|assistant|chatgpt|claude|noswipe|automated|automation)\b/i, `demo message as the user must read like the user: "${m.body}"`);
  }
  assert.ok(chat.photoUrl?.startsWith("/demo/"), "demo matches use the bundled synthetic portraits");
}
assert.ok(demo.chats.some((c) => c.messages.some((m) => m.body === "oh yesss that would be cool, i love mexican food, there's a taco place on 5th that's amazing, thursday?")));
assert.ok(demo.chats.some((c) => c.mode === "user") && demo.chats.some((c) => c.needs_user), "demo shows a taken-over chat and a needs-you chat");
assert.ok(demo.dates.every((d) => Date.parse(d.starts_at) > Date.parse("2026-11-04T12:00:00Z")), "demo dates are upcoming");

// --- validation ------------------------------------------------------------------------------
const now = new Date("2026-11-04T12:00:00Z");
assert.equal(ageFromBirthday("2000-11-04", now), 26, "birthday today");
assert.equal(ageFromBirthday("2000-11-05", now), 25, "birthday tomorrow");
assert.equal(ageFromBirthday("2008-12-01", now), 17);
assert.equal(ageFromBirthday("2000-02-31", now), null, "impossible date");
assert.equal(ageFromBirthday("nope", now), null);
assert.equal(stepSchemas.birthday.safeParse({ birthday: "2015-01-01" }).success, false, "under 18 is rejected");
assert.equal(stepSchemas.birthday.safeParse({ birthday: "1996-05-14" }).success, true);
assert.equal(stepSchemas.name.safeParse({ firstName: "  " }).success, true, "name is optional");
assert.equal(stepSchemas.birthday.safeParse({ birthday: "" }).success, false, "birthday is required (age gate)");
assert.equal(stepSchemas.birthday.safeParse({ birthday: "2012-06-01" }).success, false, "under 18 is blocked");
assert.equal(stepSchemas.birthday.safeParse({ birthday: "1998-06-01" }).success, true, "adult birthday passes");
assert.equal(stepSchemas.birthday.safeParse({ birthday: "not-a-date" }).success, false, "a given birthday must be valid");
assert.equal(stepSchemas.who.safeParse({ gender: "", interestedIn: [] }).success, true, "who is optional");
assert.equal(stepSchemas.about.safeParse({ job: "", heightCm: null, interests: [] }).success, true, "about is optional");
assert.equal(stepSchemas.about.safeParse({ job: "Designer", heightCm: null, interests: ["a", "b", "c", "d"] }).success, false, "at most three interests");
assert.equal(stepSchemas.about.safeParse({ job: "Designer", heightCm: null, interests: ["a", "b", "c"] }).success, true);
assert.equal(stepSchemas.type.safeParse({ city: "Austin", ageMin: 30, ageMax: 25, distanceKm: 50, lookingFor: "committed", dealbreakers: ["a", "b", "c"] }).success, false, "age range order");
assert.equal(stepSchemas.type.safeParse({ city: "Austin", ageMin: 25, ageMax: 30, distanceKm: 50, lookingFor: "committed", dealbreakers: ["a", "b", "c"] }).success, true);
const apps = stepSchemas.apps.parse({ apps: ["hinge", "hinge", "tinder"] });
assert.deepEqual(apps.apps, ["hinge", "tinder"], "apps are de-duplicated");
assert.equal(stepSchemas.apps.safeParse({ apps: ["grindr"] }).success, false);
assert.equal(stepSchemas.apps.safeParse({ apps: [] }).success, true, "apps are optional");
assert.equal(stepSchemas.type.safeParse({ city: "", ageMin: null, ageMax: null, distanceKm: null, lookingFor: "", dealbreakers: [] }).success, true, "type is optional");
assert.deepEqual([...APPS], ["tinder", "hinge", "bumble"]);
assert.equal(initials("Maya Chen"), "MC");

// --- consent wording (fixed text: it is what the user agrees to) ------------------------------
assert.equal(CONSENT_STATEMENT, "NoSwipe runs your profile, swipes and chats as you on the apps you picked, using these photos. You can pause, take over or resume any app, and take over any chat, at any time.");

// --- .ics -------------------------------------------------------------------------------------
const ics = buildIcs({ id: "abc", who: "Maya", venue: "Taco place, 5th", address: "500 5th St; Austin", starts_at: "2027-01-14T19:00:00Z", summary: "Creek story,\nand dogs", status: "booked" }, 90, now);
assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
assert.match(ics, /DTSTART:20270114T190000Z\r\n/);
assert.match(ics, /DTEND:20270114T203000Z\r\n/, "90 minutes");
assert.match(ics, /SUMMARY:Date with Maya\r\n/);
assert.match(ics, /LOCATION:Taco place\\, 5th\\, 500 5th St\; Austin\r\n/, "commas and semicolons are escaped");
assert.match(ics, /DESCRIPTION:Creek story\\,\\nand dogs\r\n/, "newlines are escaped");
assert.match(ics, /END:VCALENDAR\r\n$/);

// --- emails -----------------------------------------------------------------------------------
const login = buildLoginEmail("https://www.noswipe.app/auth/callback?token_hash=x&type=email", "12345678");
assert.ok(login.text.includes("12345678") && login.html.includes("12345678"));
assert.ok(!/supabase/i.test(login.text + login.html), "no Supabase branding");
const needs = buildNeedsYouEmail({ who: "Maya", link: "https://www.noswipe.app/chats/1" });
assert.ok(needs.subject.includes("Maya") && needs.text.includes("/chats/1"));
const booked = buildDateBookedEmail({ who: "Maya <b>", venue: "Taco place", startsAt: "2027-01-14T19:00:00Z", link: "https://www.noswipe.app/dates/1" });
assert.ok(!booked.html.includes("<b>"), "names are HTML-escaped");
for (const body of [needs.text, booked.text]) assert.ok(body.includes("Profile → Notifications"), "every notification says how to turn it off");

// --- migration (static) -----------------------------------------------------------------------
const sql = readFileSync(new URL("../supabase/2026-11-04-app.sql", import.meta.url), "utf8");
const tables = ["profiles", "profile_photos", "preferences", "consents", "app_accounts", "matches", "messages", "takeovers", "dates"];
for (const t of tables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${t} \\(`), `${t}: created idempotently`);
  assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t}: RLS on`);
}
assert.match(sql, /revoke all on public\.profiles[\s\S]*from public, anon, authenticated/, "browser roles revoked first");
assert.doesNotMatch(sql, /grant [^;]*\b(insert|update|delete)\b[^;]*to (anon|authenticated)/i, "no browser writes");
assert.doesNotMatch(sql, /to anon/i, "anon gets nothing");
assert.match(sql, /user_id = \(select auth\.uid\(\)\)/, "own-rows policies");
assert.match(sql, /bucket_id = 'profile-photos'[\s\S]*storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/, "photo bucket is owner-only");
assert.match(sql, /values \('profile-photos', 'profile-photos', false/, "photo bucket is private");
assert.match(sql, /create trigger messages_guard_trg/, "takeover guard trigger");
assert.match(sql, /'system_internal'\)\);/, "internal notices are a message sender");
assert.match(sql, /AI sends are blocked/, "AI send during takeover raises");
assert.doesNotMatch(sql, /\bdrop table\b|\btruncate\b/i, "migration never destroys data");

console.log("app: all checks passed");

// --- finish-setting-up card (unpaid, onboarded users) ------------------------------------------
import { CONFIRM_MAX_MS, RESUME_COPY, RESUME_FORBIDDEN, buildResumePayload, pollUntilPaid } from "../src/lib/app/resume";
import { reservationSchema, onboardingSchema } from "../src/lib/reservation";
import { CLIENT_EVENTS } from "../src/lib/attribution";

for (const [k, v] of Object.entries(RESUME_COPY)) assert.equal(RESUME_FORBIDDEN.test(v), false, `resume copy "${k}" uses a banned word`);
assert.ok(RESUME_COPY.title.startsWith("One step left: activate NoSwipe so our team starts setting up your apps"));
assert.ok((CLIENT_EVENTS as readonly string[]).includes("resume_card_view") && (CLIENT_EVENTS as readonly string[]).includes("resume_card_click"));
assert.match(readFileSync("supabase/2026-11-11-resume-card-events.sql", "utf8"), /resume_card_click[\s\S]*enable row level security[\s\S]*revoke all on public\.funnel_events from public, anon, authenticated/);

// Partial onboarding (everything skipped) still produces a payload /api/checkout accepts.
const blank = { email: "A@Example.test", city: "", interestedIn: [], lookingFor: null, name: "", age: null, apps: [], ageMin: null, ageMax: null, interests: [] };
const payload = buildResumePayload(blank, { attribution: {}, funnelSessionId: "x" });
assert.equal(reservationSchema.safeParse(payload).success, true, "blank answers still check out");
assert.equal(onboardingSchema.safeParse(payload.onboarding).success, true);
assert.equal(payload.datingPreference, "all_genders");
const full = buildResumePayload({ ...blank, city: " Austin ", interestedIn: ["women"], lookingFor: "committed", name: "Sam", age: 27, apps: ["hinge", "grindr"], ageMin: 25, ageMax: 20, interests: ["a", "", "b"] }, { attribution: {}, funnelSessionId: "x" });
assert.equal(full.datingPreference, "women"); assert.equal(full.relationshipGoal, "committed"); assert.equal(full.city, "Austin");
assert.deepEqual(full.onboarding.apps, ["hinge"]); assert.ok(full.onboarding.ageMax >= full.onboarding.ageMin);
assert.equal(reservationSchema.safeParse(full).success, true);
assert.equal(onboardingSchema.safeParse(full.onboarding).success, true);

// Confirming: webhook late -> poll stops by 10 s and resolves "unconfirmed" (success state, never a second pay button).
void (async () => {
  let t = 0; let calls = 0;
  const r = await pollUntilPaid(async () => { calls++; return "pending"; }, { sleep: async (ms) => { t += ms; }, now: () => t });
  assert.equal(r, "unconfirmed"); assert.ok(t <= CONFIRM_MAX_MS, `polled ${t} ms`); assert.ok(calls >= 5);
  let n = 0; t = 0;
  assert.equal(await pollUntilPaid(async () => (++n === 3 ? "paid" : "pending"), { sleep: async (ms) => { t += ms; }, now: () => t }), "paid");
  t = 0;
  assert.equal(await pollUntilPaid(async () => { throw new Error("net"); }, { sleep: async (ms) => { t += ms; }, now: () => t }), "unconfirmed", "network errors never throw");
})();
console.log("resume card checks ok");
