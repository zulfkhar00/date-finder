// Operator tools: kit text fitted to each app's limits, photo order, zip, time zones, checklist -> status rules, needs-you templates,
// SLA order / filters / counts, alert key, and the migration file. Pure functions only (the database flows are in check-fulfilment.mts).
// Run with: node --conditions=react-server --import tsx scripts/check-operator.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRow, type QueueInput, type QueueRow } from "../src/lib/fulfilment/core";
import { CHECKLIST_STEPS, NEEDS_YOU_TEMPLATES, canTick, decideTransition, progress, resolveReason } from "../src/lib/operator/checklist";
import { APP_LIMITS, buildKit, buildPhotos, convertClock, fitText, isValidTimezone, sectionText, type KitInput } from "../src/lib/operator/kit";
import { BUCKET_LABELS, applyOpsFilters, compareSla, needsSetupAlert, opsStatusOf, parseOpsFilters, queueCounts, setupAlertKey, setupAlertLine, slaBucket } from "../src/lib/operator/queue";
import { crc32, safeName, zipStore } from "../src/lib/operator/zip";
import { REASON_MAX } from "../src/lib/app/domain";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const H = 3_600_000;
const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * H).toISOString();

// ---------- fitText: never over the limit, whole sentences first, whole words after ----------
{
  const long = "I run a small climbing gym and I still get lost on every trail. ".repeat(20);
  for (const max of [150, 300, 500]) {
    const f = fitText(long, max);
    assert.ok(f.text.length <= max, `fits ${max}`); assert.ok(f.clipped); assert.match(f.text, /[.]$/, "ends on a sentence");
  }
  assert.deepEqual(fitText("  short   one  ", 50), { text: "short one", clipped: false });
  const noStops = fitText("word ".repeat(100), 150);
  assert.ok(noStops.text.length <= 150 && !noStops.text.endsWith(" ") && noStops.clipped, "whole words, no trailing space");
  assert.equal(fitText("x".repeat(200), 150).text.length, 150, "one giant word is hard-cut at the limit");
  assert.equal(fitText("a".repeat(150), 150).clipped, false, "exactly the limit is untouched");
}

// ---------- the kit ----------
const P = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bigBio = "I build things for a living and cook for fun. ".repeat(30);
const pack = {
  v: 1 as const,
  profiles: [
    { app: "hinge" as const, bio: bigBio, prompts: [1, 2, 3].map((i) => ({ prompt: `Prompt ${i}`, answer: "A fairly long answer about weekend plans. ".repeat(6) })) },
    { app: "tinder" as const, bio: bigBio },
    { app: "general" as const, bio: "General bio. ".repeat(40) }
  ],
  photos: { kind: "ranked" as const, order: [
    { photo_id: P(3), role: "lead" as const, reason: "x" }, { photo_id: P(1), role: "keep" as const, reason: "x" },
    { photo_id: P(2), role: "drop" as const, reason: "x" }, { photo_id: P(4), role: "keep" as const, reason: "flagged" }
  ], add: [] },
  openers: [1, 2, 3, 4, 5].map((i) => ({ line: `Opener ${i}`, why: "why" })),
  replies: [1, 2, 3].map((i) => ({ situation: `Situation ${i}`, template: `Template ${i}` })),
  datePlan: { headline: "Coffee then a walk", venues: [{ type: "Cafe", why: "easy" }, { type: "Park", why: "open" }], when: "Thursday after work", budget: "$30", backup: "Museum" }
};
const input = (app: KitInput["app"], over: Partial<KitInput> = {}): KitInput => ({
  app, profile: { first_name: "Sam", gender: "man", interested_in: ["woman"], voice: "playful", city: "Austin" },
  prefs: { age_min: 24, age_max: 32, distance_km: 40, looking_for: "relationship", dealbreakers: ["smokes", " smokes ", "no kids", ""] },
  pack, photos: [1, 2, 3, 4, 5].map((i) => ({ id: P(i), position: i, flagged: i === 4 })), ...over
});
{
  const hinge = buildKit(input("hinge"));
  assert.ok(hinge.bio.text!.length <= APP_LIMITS.hinge.bio && hinge.bio.length === hinge.bio.text!.length && hinge.bio.clipped);
  assert.equal(hinge.prompts.items.length, 3); assert.ok(hinge.prompts.items.every((p) => p.answer.length <= 150 && p.clipped), "Hinge: 3 prompts, each at most 150");
  const tinder = buildKit(input("tinder"));
  assert.ok(tinder.bio.text!.length <= 500 && tinder.bio.text!.length > 300, "Tinder gets up to 500 of the same text");
  assert.equal(tinder.prompts.items.length, 0); assert.equal(tinder.prompts.max, 0);
  const bumble = buildKit(input("bumble"));
  assert.equal(bumble.bio.source, "general", "no Bumble entry: the general profile, cut to 300"); assert.ok(bumble.bio.text!.length <= 300);
  for (const app of ["tinder", "hinge", "bumble"] as const) assert.ok(buildKit(input(app)).photos.items.length <= APP_LIMITS[app].photos);
  // no pack yet: sections still build and say so
  const bare = buildKit(input("tinder", { pack: null }));
  assert.equal(bare.bio.text, null); assert.equal(bare.bio.source, "none"); assert.equal(sectionText("bio", bare), "");
  assert.deepEqual(bare.photos.items.map((p) => p.photoId), [P(1), P(2), P(3), P(5)], "client's own order, flagged photo left out");
  // filters, tone, dealbreakers, schedule
  assert.deepEqual([hinge.filters.show, hinge.filters.ageMin, hinge.filters.ageMax, hinge.filters.distanceKm, hinge.filters.distanceMiles], ["women", 24, 32, 40, 25]);
  assert.equal(buildKit(input("tinder", { profile: { ...input("tinder").profile, interested_in: ["man", "woman"] } })).filters.show, "everyone");
  assert.equal(buildKit(input("tinder", { prefs: null })).filters.ageMin, null, "no preferences: not set, not guessed");
  assert.deepEqual(hinge.dealbreakers.items, ["smokes", "no kids"], "deduplicated, blanks dropped");
  assert.match(hinge.tone.guide, /playful/i); assert.match(hinge.tone.guide, /first person/i); assert.doesNotMatch(hinge.tone.guide, /bot line|written by/i);
  assert.equal(hinge.tone.openers.length, 5); assert.equal(hinge.tone.replies.length, 3);
  assert.equal(buildKit(input("hinge", { profile: { ...input("hinge").profile, voice: "weird" } })).tone.voice, "warm");
  assert.ok(hinge.schedule.windows.length >= 1); assert.match(String(hinge.schedule.plan), /Thursday after work/);
  assert.match(sectionText("filters", hinge), /Show me: women/); assert.match(sectionText("prompts", hinge), /Prompt 1\n/);

  // photos: ranked order, drops and flagged left out, then fill from the rest
  const ph = buildPhotos(input("hinge"));
  assert.deepEqual(ph.items.map((p) => [p.photoId, p.role]), [[P(3), "lead"], [P(1), "keep"], [P(5), "fill"]], "lead first, drop and flagged skipped, unranked photo fills in");
  assert.equal(ph.skippedFlagged, 1); assert.equal(ph.note, null);
  assert.match(String(buildPhotos(input("hinge", { photos: [{ id: P(1), position: 1, flagged: true }] })).note), /No usable photos/);
  assert.match(String(buildPhotos(input("hinge", { photos: [{ id: P(1), position: 1, flagged: false }, { id: P(2), position: 2, flagged: false }] })).note), /Fewer than 3/);
  const nine = Array.from({ length: 12 }, (_, i) => ({ id: P(i + 1), position: i, flagged: false }));
  assert.equal(buildPhotos(input("tinder", { pack: null, photos: nine })).items.length, 9);
  assert.equal(buildPhotos(input("hinge", { pack: null, photos: nine })).items.length, 6);
}

// ---------- zip ----------
{
  const files = [{ name: "01-lead.jpg", data: new Uint8Array([1, 2, 3, 4, 5]) }, { name: "../../etc/passwd", data: new Uint8Array([9, 9]) }];
  const zip = zipStore(files, NOW);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50, "starts with a local header");
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50, "ends with the end-of-central-directory record");
  assert.equal(view.getUint16(zip.length - 22 + 10, true), 2, "two entries");
  const centralOffset = view.getUint32(zip.length - 22 + 16, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
  assert.equal(view.getUint32(14, true), crc32(files[0].data), "crc matches"); assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "standard crc32 check value");
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + 11)), "01-lead.jpg");
  assert.ok(!safeName("../../etc/passwd").includes("/"), "no path separators survive");
  assert.deepEqual([...zip.slice(30 + 11, 30 + 11 + 5)], [1, 2, 3, 4, 5], "stored, not compressed");
}

// ---------- time zones ----------
{
  assert.equal(isValidTimezone("America/Los_Angeles"), true); assert.equal(isValidTimezone("Mars/Base"), false); assert.equal(isValidTimezone(""), false);
  assert.equal(convertClock("18:00", "2026-11-20", "America/Los_Angeles", "UTC"), "02:00", "PST is UTC-8 in November");
  assert.equal(convertClock("18:00", "2026-07-20", "America/Los_Angeles", "UTC"), "01:00", "PDT is UTC-7 in July (DST handled)");
  assert.equal(convertClock("21:30", "2026-11-20", "Europe/London", "UTC"), "21:30");
  assert.equal(convertClock("09:00", "2026-11-20", "UTC", "America/New_York"), "04:00");
}

// ---------- checklist rules ----------
{
  assert.equal(CHECKLIST_STEPS.length, 6);
  assert.deepEqual(CHECKLIST_STEPS, ["create_account", "verify", "upload_photos", "set_filters", "assign_phone", "first_session"]);
  const all = CHECKLIST_STEPS.map((step) => ({ step }));
  assert.deepEqual(progress([]), { done: 0, total: 6, complete: false, next: "create_account" });
  assert.equal(progress(all).complete, true); assert.equal(progress(all.slice(0, 5)).next, "first_session");
  assert.equal(progress([...all, ...all]).done, 6, "duplicates do not over-count");
  assert.equal(canTick("assign_phone", { phoneAssigned: false }).ok, false); assert.equal(canTick("assign_phone", { phoneAssigned: true }).ok, true); assert.equal(canTick("verify", { phoneAssigned: false }).ok, true);

  const t = (status: Parameters<typeof decideTransition>[0]["status"], paused = false, ticks = all) => decideTransition({ status, user_paused: paused }, ticks).to;
  assert.equal(t("setting_up"), "active"); assert.equal(t("awaiting_login"), "active", "the retired state reads as setting up");
  assert.equal(decideTransition({ status: "setting_up", user_paused: false }, all.slice(0, 5)).why, "not_complete"); assert.equal(t("setting_up", false, all.slice(0, 5)), null);
  assert.equal(t("setting_up", true), null, "client paused mid-setup: nothing activates");
  for (const s of ["needs_client_action", "active", "live", "paused", "closed"] as const) assert.equal(t(s), null, `${s} is left alone`);

  // needs-you templates
  assert.ok(NEEDS_YOU_TEMPLATES.some((x) => /selfie/i.test(x.text)), "a selfie-for-verification template exists");
  for (const tpl of NEEDS_YOU_TEMPLATES) { const r = resolveReason(tpl.id, ""); assert.ok(r.ok && r.reason === tpl.text && tpl.text.length <= REASON_MAX, tpl.id); }
  assert.deepEqual(resolveReason("selfie", "  Send  a clear selfie  "), { ok: true, reason: "Send a clear selfie" }, "own words win and are normalised");
  assert.equal(resolveReason("nope", "").ok, false); assert.equal(resolveReason("selfie", "x".repeat(REASON_MAX + 1)).ok, false);
}

// ---------- ops queue: SLA order, filters, counts, alert key ----------
const input1 = (o: Partial<QueueInput> & { id: string }): QueueInput => ({
  userId: o.id, firstName: "Sam", email: `${o.id}@real.org`, createdAt: ago(300), onboardingDoneAt: ago(100), paid: true, paidAt: ago(100), country: "US",
  apps: [{ app: "hinge", status: "setting_up", userPaused: false, reason: null, changedAt: null }], packStatus: "ready", photoCount: 4, flaggedPhotos: 0, hold: null, lastEventAt: null, ...o
});
const row = (o: Partial<QueueInput> & { id: string }): QueueRow => buildRow(input1(o), NOW);
{
  assert.equal(slaBucket(0), "under24"); assert.equal(slaBucket(23), "under24"); assert.equal(slaBucket(24), "h24"); assert.equal(slaBucket(47), "h24");
  assert.equal(slaBucket(48), "h48"); assert.equal(slaBucket(72), "h48", "72 h exactly is not yet over"); assert.equal(slaBucket(73), "h72");
  assert.equal(Object.keys(BUCKET_LABELS).length, 4);

  const active = [{ app: "hinge" as const, status: "active" as const, userPaused: false, reason: null, changedAt: ago(1) }];
  const rows = [
    row({ id: "p-30", paidAt: ago(30), onboardingDoneAt: ago(30) }),
    row({ id: "p-80", paidAt: ago(80), onboardingDoneAt: ago(90) }),
    row({ id: "p-50", paidAt: ago(50), onboardingDoneAt: ago(60), apps: [{ app: "tinder", status: "needs_client_action", userPaused: false, reason: "selfie", changedAt: ago(2) }, { app: "bumble", status: "setting_up", userPaused: false, reason: null, changedAt: null }] }),
    row({ id: "done", paidAt: ago(200), onboardingDoneAt: ago(200), apps: active }),
    row({ id: "held", paidAt: ago(300), onboardingDoneAt: ago(300), hold: "paused" }),
    row({ id: "int", paidAt: ago(400), onboardingDoneAt: ago(400), internal: true }),
    row({ id: "unpaid", paid: false, paidAt: null, onboardingDoneAt: ago(120) })
  ];
  const sorted = [...rows].sort(compareSla).map((r) => r.userId);
  assert.deepEqual(sorted.slice(0, 3), ["p-80", "p-50", "p-30"], "paid and setting up: longest wait first");
  assert.equal(sorted.at(-1), "int", "internal last"); assert.equal(sorted.at(-2), "held", "report hold just before");
  assert.ok(sorted.indexOf("done") > sorted.indexOf("p-30") && sorted.indexOf("unpaid") > sorted.indexOf("p-30"), "handled and unpaid clients are not ahead of paid setups");

  // filters
  const f = (q: Record<string, string>) => applyOpsFilters(rows, parseOpsFilters(q)).map((r) => r.userId);
  assert.ok(!f({}).includes("int"), "internal hidden by default"); assert.ok(f({ internal: "1" }).includes("int"));
  assert.deepEqual(f({ min: "72" }), ["p-80"], "over 72 h: paid and still waiting only");
  assert.deepEqual(f({ min: "48" }).sort(), ["p-50", "p-80"]);
  assert.deepEqual(f({ app: "bumble" }), ["p-50"]); assert.deepEqual(f({ app: "tinder", status: "needs_client_action" }), ["p-50"]);
  assert.deepEqual(f({ app: "tinder", status: "setting_up" }), [], "app and status apply to the same app");
  assert.deepEqual(f({ status: "active" }), ["done"]);
  assert.deepEqual(parseOpsFilters({ app: "okcupid", status: "x", min: "5" }), { app: null, status: null, minHours: null, internal: false }, "junk is ignored");
  assert.equal(opsStatusOf({ status: "active", userPaused: false }, "paused"), "paused", "a report hold wins"); assert.equal(opsStatusOf({ status: "active", userPaused: false }, "closed"), "closed");
  assert.equal(opsStatusOf({ status: "setting_up", userPaused: true }, null), "paused", "the client's pause shows as paused"); assert.equal(opsStatusOf({ status: "live", userPaused: false }, null), "active");
  assert.equal(opsStatusOf({ status: "awaiting_login", userPaused: false }, null), "setting_up");

  // counts: internal never counted, held not on the clock
  const c = queueCounts(rows);
  assert.equal(c.waiting, 3); assert.equal(c.over24, 3); assert.equal(c.over48, 2); assert.equal(c.over72, 1);
  assert.equal(c.needsYou, 1); assert.equal(c.active, 1);
  assert.equal(c.settingUp, 4, "p-30, p-80, bumble of p-50 and the unpaid one; held shows paused and internal is not counted");

  // 48 h setup alert
  assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(48), onboardingDoneAt: ago(60) })), true); assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(47), onboardingDoneAt: ago(60) })), false);
  assert.equal(needsSetupAlert(row({ id: "a", paid: false, paidAt: null, onboardingDoneAt: ago(200) })), false, "unpaid never");
  assert.equal(needsSetupAlert(row({ id: "a", hold: "paused", paidAt: ago(100) })), false, "report hold never");
  assert.equal(needsSetupAlert(row({ id: "a", internal: true, paidAt: ago(100) })), false, "internal never");
  assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(100), apps: active })), false, "active: done");
  assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(100), apps: [{ app: "hinge", status: "setting_up", userPaused: true, reason: null, changedAt: null }] })), false, "client paused mid-setup: not our delay");
  assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(100), apps: [{ app: "hinge", status: "needs_client_action", userPaused: false, reason: "selfie", changedAt: ago(5) }] })), false, "waiting on the client");
  assert.equal(needsSetupAlert(row({ id: "a", paidAt: ago(100), apps: [{ app: "hinge", status: "active", userPaused: false, reason: null, changedAt: null }, { app: "tinder", status: "setting_up", userPaused: false, reason: null, changedAt: ago(3) }] })), true, "any app still setting up, even if touched");
  assert.equal(setupAlertKey("u1", 48), setupAlertKey("u1", 95)); assert.notEqual(setupAlertKey("u1", 95), setupAlertKey("u1", 96)); assert.notEqual(setupAlertKey("u1", 50), setupAlertKey("u2", 50));
  const line = setupAlertLine(row({ id: "x", firstName: "SECRETNAME", email: "secret@real.org", paidAt: ago(60) }), "https://noswipe.app/admin/clients/x/kit");
  assert.doesNotMatch(line, /SECRETNAME|secret@/); assert.match(line, /still setting up after 60 h \(Hinge\)/);
}

// ---------- migration + wiring ----------
{
  const sql = read("../supabase/2026-11-22-operator-kit.sql");
  for (const t of ["account_kits", "account_checklist"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`)); assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.match(sql, /revoke all on public\.account_kits, public\.account_checklist from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*(anon|authenticated)/i, "server only: no browser role gets anything");
  assert.doesNotMatch(sql, /drop table|truncate|delete from|update public\./i, "additive");
  for (const line of sql.split("\n")) if (/^\s*create (table|index|unique index)/i.test(line)) assert.match(line, /if not exists/, line);
  for (const step of CHECKLIST_STEPS) assert.ok(sql.includes(`'${step}'`), `${step} is allowed by the check constraint`);
  assert.match(read("../src/app/admin/clients/[id]/kit/page.tsx"), /requireAdminPage/); assert.match(read("../src/app/admin/clients/[id]/kit/photos/route.ts"), /adminEmailOrNull/);
  const actions = read("../src/app/admin/clients/actions.ts");
  assert.equal((actions.match(/adminEmailOrNull\(\)/g) ?? []).length >= 14, true, "every operator action checks the admin");
  assert.doesNotMatch(read("../src/lib/operator/service.ts"), /console\.(log|error)\([^)]*(email|bio|path|first_name|body)/i, "no content in logs");
  assert.doesNotMatch(read("../src/lib/operator/service.ts"), /NEXT_PUBLIC/);
}

console.log("check-operator: ok");
