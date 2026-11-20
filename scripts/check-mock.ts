// Checks for the owner-only walkthrough at /app: who may enter, and the sample-data rules. No browser, no network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isOwner, isOwnerEmail, ownerAllowlist } from "../src/lib/app/owner";
import {
  MAX_MESSAGE, REPLY_DELAY_MS, cancelDate, chatSummaries, completeOnboarding, confirmDate, dateGroups, fireReply, fresh, handBack, needsYouChats,
  nextDraft, parseStored, quiet, requestDraft, saveStep, seed, sendMessage, skipDraft, takeOver, lastReal
} from "../src/lib/app/mock-core";
import { parseSystemEvent } from "../src/lib/app/domain";

// --- the gate ---
const LIST = "founder@example.test, Second@Example.test";
assert.equal(isOwnerEmail("founder@example.test", LIST), true);
assert.equal(isOwnerEmail("SECOND@example.test", LIST), true, "case-insensitive");
assert.equal(isOwnerEmail("stranger@example.test", LIST), false);
assert.equal(isOwnerEmail("founder@example.test", ""), false, "empty list matches nobody");
assert.equal(isOwnerEmail("founder@example.test", undefined), false);
assert.equal(isOwner({ email: "founder@example.test", email_confirmed_at: "2026-11-20" }, LIST), true);
assert.equal(isOwner({ email: "founder@example.test", email_confirmed_at: null }, LIST), false, "unconfirmed address never passes");
assert.equal(isOwner({ email: "stranger@example.test", email_confirmed_at: "2026-11-20" }, LIST), false);
assert.equal(isOwner(null, LIST), false);
assert.equal(ownerAllowlist({ ADMIN_EMAILS: "a@x.test", OWNER_APP_EMAILS: "b@x.test" }), "a@x.test,b@x.test");
assert.equal(ownerAllowlist({}), "");

// Every /app page except the sign-in screens checks the owner itself.
const root = new URL("../src/app/app/", import.meta.url).pathname;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const open = ["/login/", "/auth/", "/reset/"];
for (const file of walk(root).filter((f) => /\/(page|layout|route)\.tsx?$/.test(f))) {
  const rel = file.slice(root.length - 1);
  if (open.some((o) => rel.startsWith(o)) || rel === "/layout.tsx") continue;
  const src = readFileSync(file, "utf8");
  assert.match(src, /requireOwner\(\)/, `${rel} must call requireOwner()`);
}
const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
assert.match(proxy, /"\/app", "\/app\/:path\*"/, "the session refresh and noindex header cover /app");
const sitemap = readFileSync(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");
assert.doesNotMatch(sitemap, /["'`]\/app/, "/app is not in the sitemap");

// --- the sample data ---
const NOW = Date.parse("2026-11-20T12:00:00Z");
const s = seed(NOW);
assert.ok(s.matches.length >= 6, "several matches");
assert.deepEqual([...new Set(s.matches.map((m) => m.app))].sort(), ["bumble", "hinge", "tinder"], "all three apps");
assert.ok(s.matches.some((m) => m.messages.length === 0), "a brand-new match with no messages");
assert.ok(s.matches.some((m) => m.messages.length >= 25), "a long thread");
assert.ok(s.matches.some((m) => m.name.length > 30), "a very long name");
assert.ok(s.matches.some((m) => m.mode === "user"), "a chat the user took over");
const groups = dateGroups(s, NOW);
assert.ok(groups.proposed.length && groups.upcoming.length && groups.past.length, "proposed, upcoming and past dates");
assert.ok(s.dates.some((d) => d.match_id === null), "a date with no chat");
// Nothing a match could see mentions the product, AI or a bot; and messages are in order.
for (const m of s.matches) {
  const times = m.messages.map((x) => Date.parse(x.sent_at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b), `${m.id} messages are in order`);
  for (const x of m.messages.filter((y) => y.sender !== "system_internal")) assert.doesNotMatch(x.body, /\b(noswipe|bot|ai|assistant|automat)/i, `${m.id}: ${x.body}`);
  for (const o of [...(m.draft?.options ?? []), ...m.script.flatMap((st) => [st.reply, ...st.drafts])]) assert.doesNotMatch(o, /\b(noswipe|bot|ai|assistant|automat)/i, o);
}
const serialized = JSON.stringify(s);
assert.doesNotMatch(serialized, /bay area|waitlist|holds your spot|\$1\b/i, "no banned copy in the sample data");
assert.deepEqual(parseStored(JSON.stringify(s))?.matches.length, s.matches.length, "state round-trips");
assert.equal(parseStored("{not json"), null);
assert.equal(parseStored(JSON.stringify({ ...s, v: 99 })), null, "an old version is ignored");
assert.equal(parseStored(null), null);

// --- chats ---
assert.ok(needsYouChats(s).length >= 2, "chats waiting on the user");
const chloe = s.matches.find((m) => m.id === "chloe")!;
assert.ok(chloe.draft && chloe.messages.length === 0, "the opener is a draft on an empty chat");
const empty = sendMessage(s, "chloe", "   ", NOW);
assert.ok(empty.error && empty.state === s, "blank messages are refused");
assert.ok(sendMessage(s, "chloe", "x".repeat(MAX_MESSAGE + 1), NOW).error, "oversize messages are refused");
assert.ok(sendMessage(s, "nobody", "hi", NOW).error, "unknown chat");
const sent = sendMessage(s, "chloe", chloe.draft.options[0], NOW).state;
const c1 = sent.matches.find((m) => m.id === "chloe")!;
assert.equal(c1.draft, null, "sending clears the draft");
assert.equal(c1.needs_user, false);
assert.equal(c1.messages.at(-1)?.sender, "user");
assert.ok(c1.pendingReplyAt && Date.parse(c1.pendingReplyAt) === NOW + REPLY_DELAY_MS, "a reply is queued");
const twice = sendMessage(sent, "chloe", "one more", NOW + 1000).state.matches.find((m) => m.id === "chloe")!;
assert.equal(twice.pendingReplyAt, c1.pendingReplyAt, "a second message does not queue a second reply");
const replied = fireReply(sent, "chloe", NOW + REPLY_DELAY_MS).matches.find((m) => m.id === "chloe")!;
assert.equal(lastReal(replied)?.sender, "match", "their reply lands");
assert.equal(replied.pendingReplyAt, null);
assert.ok(replied.draft && replied.needs_user, "autopilot prepares the next draft");
assert.equal(fireReply(fireReply(sent, "chloe", NOW), "chloe", NOW).matches.find((m) => m.id === "chloe")!.messages.length, 2, "firing twice replies once");
// After taking over, replies arrive without a draft.
const lin = fireReply(sendMessage(s, "lin", "so then", NOW).state, "lin", NOW).matches.find((m) => m.id === "lin")!;
assert.equal(lin.draft, null, "no draft while the user is in the chat");
// Retake cycles through the options; skip clears.
const jess = s.matches.find((m) => m.id === "jess")!;
assert.equal(nextDraft(s, "jess").matches.find((m) => m.id === "jess")!.draft?.i, 1);
assert.equal(nextDraft(nextDraft(s, "jess"), "jess").matches.find((m) => m.id === "jess")!.draft?.i, 0, "wraps around");
assert.equal(skipDraft(s, "jess").matches.find((m) => m.id === "jess")!.draft, null);
assert.ok(requestDraft(skipDraft(s, "jess"), "jess").matches.find((m) => m.id === "jess")!.draft, "a skipped draft can be asked for again");
assert.equal(requestDraft(s, "maya").matches.find((m) => m.id === "maya")!.draft, null, "no draft when the last message is the user's");
// Take over and hand back leave notices; handing back a chat waiting on them prepares a draft.
const took = takeOver(s, "jess", NOW);
const jt = took.matches.find((m) => m.id === "jess")!;
assert.equal(jt.mode, "user");
assert.equal(jt.draft, null);
assert.equal(parseSystemEvent(jt.messages.at(-1)!.body)?.kind, "took_over");
assert.equal(takeOver(took, "jess", NOW).matches.find((m) => m.id === "jess"), jt, "taking over twice is a no-op");
const back = handBack(took, "jess", NOW).matches.find((m) => m.id === "jess")!;
assert.equal(back.mode, "ai");
assert.ok(back.draft, "their message is still unanswered, so a draft is ready");
assert.equal(chatSummaries(s)[0].id, [...s.matches].sort((a, b) => Date.parse(lastReal(b)?.sent_at ?? b.matched_at) - Date.parse(lastReal(a)?.sent_at ?? a.matched_at))[0].id, "newest first");
void jess;

// --- dates ---
const proposed = s.dates.find((d) => d.status === "proposed")!;
const slot = proposed.slots[0];
const booked = confirmDate(s, proposed.id, slot, NOW);
const bd = booked.dates.find((d) => d.id === proposed.id)!;
assert.equal(bd.status, "booked");
assert.equal(bd.starts_at, slot, "the chosen time is kept");
assert.equal(parseSystemEvent(booked.matches.find((m) => m.id === proposed.match_id)!.messages.at(-1)!.body)?.kind, "date_booked", "the chat gets a date-booked row");
assert.equal(confirmDate(booked, proposed.id, undefined, NOW), booked, "confirming twice is a no-op");
assert.equal(confirmDate(s, proposed.id, "2030-01-01T00:00:00.000Z", NOW).dates.find((d) => d.id === proposed.id)!.starts_at, proposed.starts_at, "a time that was not offered is ignored");
assert.equal(cancelDate(booked, proposed.id).dates.find((d) => d.id === proposed.id)!.status, "cancelled");

// --- profile ---
assert.ok(saveStep(s, "birthday", { birthday: "2015-01-01" }).error, "under 18 is refused like the real flow");
assert.ok(saveStep(s, "type", { city: "", ageMin: 40, ageMax: 30, distanceKm: 5, lookingFor: "", dealbreakers: [] }).error, "youngest age first");
assert.equal(saveStep(s, "name", { firstName: "Sam" }).state.profile.firstName, "Sam");
const added = saveStep(quiet(NOW), "apps", { apps: ["tinder", "hinge", "bumble"] }).state;
assert.equal(added.apps.length, 3);

// --- onboarding and the empty states ---
const f = fresh();
assert.equal(f.onboarding.done, false);
assert.equal(f.matches.length + f.dates.length + f.apps.length, 0, "a new person starts empty");
const noApps = completeOnboarding(f, NOW);
assert.equal(noApps.matches.length, 0, "no apps picked, nothing arrives");
const tinderOnly = completeOnboarding({ ...f, profile: { ...f.profile, firstName: "Sam", apps: ["tinder"] } }, NOW);
assert.ok(tinderOnly.matches.length > 0 && tinderOnly.matches.every((m) => m.app === "tinder"), "only the picked app's matches arrive");
assert.ok(tinderOnly.dates.every((d) => d.match_id === null || tinderOnly.matches.some((m) => m.id === d.match_id)), "no dates for chats that are not there");
assert.equal(tinderOnly.onboarding.done, true);
assert.equal(quiet(NOW).matches.length, 0);

console.log("owner preview checks ok");
