// Photo flagging: parsing of the per-photo flags (junk in = unflagged out), the generator (one vision call, flagged photos
// out of the order, approved ones back in, refusal, invalid JSON), the schema file, the admin and user wiring, and privacy.
// Stub model, in-memory store, no network. Run with: node --conditions=react-server --import tsx scripts/check-photo-flags.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLAGGED_PHOTO_NOTE, executePack, claimPack, type LoadedPhotos, type ModelRequest, type ModelResponse, type PackDeps, type PackModel } from "../src/lib/starter-pack/generate";
import { DEFAULT_LIMITS } from "../src/lib/starter-pack/limits";
import { FLAG_KINDS, USER_FLAG_NOTICE, flagLabel, flaggedIds, parsePhotoFlags, type PhotoVerdict } from "../src/lib/starter-pack/photo-flags-core";
import { FLAG_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT, buildContext, buildFlagUserPrompt, buildVisionUserPrompt } from "../src/lib/starter-pack/prompts";
import { MemoryPackStore } from "../src/lib/starter-pack/store";
import { validatePhotoRanking } from "../src/lib/starter-pack/validate";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const NOW = new Date("2026-11-20T12:00:00Z");
const U1 = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const photos = [{ id: A }, { id: B }, { id: C }];

assert.deepEqual([...FLAG_KINDS], ["explicit_or_sexual", "possible_minor", "not_a_real_person_or_not_the_user", "violence_or_weapons"]);

// ---------- parsing ----------
const ranking = (items: unknown[]) => JSON.stringify({ ranking: items, add: [] });
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 1, role: "lead", reason: "x", flags: [] }, { photo: 2, role: "keep", reason: "x", flags: ["possible_minor"] }]), photos), [{ photoId: A, flags: [] }, { photoId: B, flags: ["possible_minor"] }]);
assert.deepEqual(parsePhotoFlags("```json\n" + ranking([{ photo: 3, flags: ["violence_or_weapons", "violence_or_weapons"] }]) + "\n```", photos), [{ photoId: C, flags: ["violence_or_weapons"] }], "code fence and duplicate flags tolerated");
assert.deepEqual(parsePhotoFlags(JSON.stringify({ photos: [{ photo: 1, flags: ["explicit_or_sexual"] }] }), photos), [{ photoId: A, flags: ["explicit_or_sexual"] }], "the flag-only call uses `photos`");
assert.equal(parsePhotoFlags("not json at all", photos), null, "invalid JSON = unusable (caller logs, treats as unflagged)");
assert.equal(parsePhotoFlags(JSON.stringify({ add: [] }), photos), null, "no array = unusable");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 1, role: "lead", reason: "x" }]), photos), [{ photoId: A, flags: [] }], "no `flags` key = unflagged");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 1, flags: "possible_minor" }]), photos), [{ photoId: A, flags: [] }], "flags that are not an array = unflagged, never a guess");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 1, flags: ["nsfw", "Possible_Minor", 7, null] }]), photos), [{ photoId: A, flags: [] }], "unknown kinds are dropped, case must match");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 9, flags: ["possible_minor"] }, { photo: 0, flags: ["possible_minor"] }, { photo: "x", flags: ["possible_minor"] }]), photos), [], "photo numbers out of range or not numbers are ignored");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 1, flags: ["possible_minor"] }, { photo: 1, flags: [] }]), photos), [{ photoId: A, flags: ["possible_minor"] }], "a repeated photo number counts once (first wins)");
assert.deepEqual(parsePhotoFlags(ranking([{ photo: 2, flags: [] }]), photos)?.map((v) => v.photoId), [B], "photos the model skipped are simply absent: not reviewed");
assert.deepEqual([...flaggedIds([{ photoId: A, flags: ["possible_minor"] }, { photoId: B, flags: [] }, { photoId: C, flags: ["violence_or_weapons"] }], new Set([C]))], [A], "approved photos are never flagged again");
assert.deepEqual([...flaggedIds(null)], [], "no verdicts, nothing flagged");
assert.match(flagLabel(["possible_minor", "bogus"]), /minor/i);
assert.equal(flagLabel([]), "Flagged");

// ---------- ranking excludes flagged photos ----------
const rawRank = ranking([{ photo: 1, role: "lead", reason: "Clear face.", flags: ["explicit_or_sexual"] }, { photo: 2, role: "keep", reason: "Good light." }, { photo: 3, role: "keep", reason: "Fine." }]);
const all = validatePhotoRanking(rawRank, photos);
assert.equal(all?.kind === "ranked" && all.order.length, 3, "without an exclusion list nothing changes");
const without = validatePhotoRanking(rawRank, photos, new Set([A]));
assert.ok(without?.kind === "ranked");
if (without?.kind === "ranked") {
  assert.deepEqual(without.order.map((o) => o.photo_id).sort(), [B, C].sort(), "flagged photo is not in the order");
  assert.equal(without.order.filter((o) => o.role === "lead").length, 1, "still exactly one lead");
}
const skipped = validatePhotoRanking(ranking([{ photo: 2, role: "lead", reason: "ok" }]), photos, new Set([A]));
assert.ok(skipped?.kind === "ranked" && !skipped.order.some((o) => o.photo_id === A), "a flagged photo the model skipped is not appended back either");
assert.equal(validatePhotoRanking(ranking([{ photo: 1, role: "lead", reason: "ok" }]), [{ id: A }], new Set([A])), null, "every photo flagged = no ranking");

// ---------- prompts ----------
for (const text of [VISION_SYSTEM_PROMPT, FLAG_SYSTEM_PROMPT]) {
  for (const kind of FLAG_KINDS) assert.ok(text.includes(kind), `prompt names ${kind}`);
  assert.match(text, /human reviewer/);
  assert.match(text, /never describe/i);
}
const ctxProbe = buildContext({ first_name: "Sam", birthday: "1996-04-12", gender: "man", interested_in: ["women"], city: "Austin", job: null, interests: [], voice: "warm" }, null, ["hinge"], NOW);
assert.match(buildVisionUserPrompt(ctxProbe, 3), /"flags"/, "one call returns ranking and flags together");
assert.match(buildFlagUserPrompt(2), /"photos"/);

// ---------- generator ----------
const ctx = buildContext({ first_name: "Zhanserik", birthday: "1996-04-12", gender: "man", interested_in: ["women"], city: "Almaty", job: "Nurse", interests: ["climbing"], voice: "playful" }, { looking_for: "meaningful", dealbreakers: [] }, ["hinge"], NOW);
const textJson = JSON.stringify({
  profiles: [{ app: "hinge", bio: "Nurse who climbs on weekends.", prompts: [
    { prompt: "Typical Sunday", answer: "Bouldering until my forearms quit, then ramen." },
    { prompt: "I geek out on", answer: "Anything that makes a long shift go faster." },
    { prompt: "The way to win me over is", answer: "Tell me the best thing you ate this week." }] }],
  openers: ["What's the best thing you ate this week?", "Settle this for me: ramen at midnight, yes or no?", "You look like someone with a strong coffee opinion.", "Which of your photos has the best story behind it?", "Quick, two truths and a lie about your weekend."].map((line) => ({ line, why: "Easy to answer." })),
  replies: [{ situation: "One word", template: "Fair. Give me one thing that made today better and I'll match it." }, { situation: "Going well", template: "I'm enjoying this. Coffee this week, somewhere easy to leave?" }, { situation: "What you want", template: "Something real, without rushing it. Honest answer, you?" }],
  datePlan: { headline: "Coffee and a walk", venues: [{ type: "a quiet coffee place", why: "Easy to talk." }, { type: "a short walk in a park", why: "No pressure." }], when: "Saturday, 11am", budget: "$10-20", backup: "A bookshop cafe.", tip: "Meet in public." }
});
const img = { mediaType: "image/jpeg" as const, data: "AAAA" };
const ok = (text: string, over: Partial<ModelResponse> = {}): ModelResponse => ({ text, inputTokens: 1000, outputTokens: 400, stopReason: "end_turn", ...over });

function harness(opts: { vision: (r: ModelRequest) => ModelResponse | Error; loaded: LoadedPhotos; failSave?: boolean }) {
  const requests: ModelRequest[] = [];
  const saved: PhotoVerdict[][] = [];
  const logs: string[] = [];
  const model: PackModel = { async complete(request) { requests.push(request); if (!request.images) return ok(textJson); const out = opts.vision(request); if (out instanceof Error) throw out; return out; } };
  const store = new MemoryPackStore();
  const deps: PackDeps = {
    store, model, limits: DEFAULT_LIMITS, now: () => NOW, sleep: async () => undefined,
    loadContext: async () => ctx, loadPhotos: async () => opts.loaded,
    saveFlags: async (_u, verdicts) => { if (opts.failSave) throw new Error("db down"); saved.push(verdicts); }
  };
  return { deps, store, requests, saved, logs };
}
const three: LoadedPhotos = { photos: [{ id: A, image: img }, { id: B, image: img }, { id: C, image: img }], total: 3 };
const quiet = async <T,>(fn: () => Promise<T>): Promise<{ value: T; errors: string[] }> => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(" ")); };
  try { return { value: await fn(), errors }; } finally { console.error = original; }
};

async function main() {
  // One vision call carries ranking + flags; a flagged photo is saved, held out of the order, the pack still completes.
  {
    const h = harness({ loaded: three, vision: () => ok(rawRank) });
    const { value } = await quiet(async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; });
    assert.deepEqual(value, { status: "ready" });
    assert.equal(h.requests.filter((r) => r.images).length, 1, "no extra model call for flags");
    assert.deepEqual(h.saved[0], [{ photoId: A, flags: ["explicit_or_sexual"] }, { photoId: B, flags: [] }, { photoId: C, flags: [] }]);
    const content = h.store.rows[0].content;
    assert.ok(content?.photos.kind === "ranked");
    if (content?.photos.kind === "ranked") assert.ok(!content.photos.order.some((o) => o.photo_id === A), "flagged photo is not in the pack's photo order");
  }
  // Approved photo: the model's flag no longer applies, it stays in the order.
  {
    const h = harness({ loaded: { total: 3, photos: [{ id: A, image: img, approved: true }, { id: B, image: img }, { id: C, image: img }] }, vision: () => ok(rawRank) });
    await quiet(() => (async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; })());
    const content = h.store.rows[0].content;
    assert.ok(content?.photos.kind === "ranked" && content.photos.order.some((o) => o.photo_id === A), "false positive approved by a person is back in the order");
  }
  // Invalid JSON from the vision call: treated as unflagged, logged by code only, checklist fallback, pack still ready.
  {
    const h = harness({ loaded: three, vision: () => ok("I cannot help with that {") });
    const { value, errors } = await quiet(async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; });
    assert.deepEqual(value, { status: "ready" });
    assert.equal(h.saved.length, 0, "nothing flagged, nothing saved");
    assert.equal(h.store.rows[0].content?.photos.kind, "checklist");
    assert.ok(errors.some((e) => e.includes("Photo flags unusable")), "the code is logged");
    assert.ok(errors.every((e) => !e.includes("cannot help") && !e.includes("AAAA")), "never the model's text or the image");
  }
  // Valid ranking JSON but no flags key at all: unflagged, ranked as before.
  {
    const h = harness({ loaded: three, vision: () => ok(ranking([{ photo: 1, role: "lead", reason: "Clear." }, { photo: 2, role: "keep", reason: "ok" }, { photo: 3, role: "keep", reason: "ok" }])) });
    await quiet(() => (async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; })());
    assert.equal(h.store.rows[0].content?.photos.kind, "ranked");
    assert.ok(h.saved[0].every((v) => v.flags.length === 0), "all clear");
  }
  // Model refusal on the photos: nothing flagged (a refusal is not a verdict), checklist, pack ready.
  {
    const h = harness({ loaded: three, vision: () => ok("", { stopReason: "refusal" }) });
    const { value } = await quiet(async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; });
    assert.deepEqual(value, { status: "ready" });
    assert.equal(h.saved.length, 0, "a refusal flags nothing");
    assert.equal(h.store.rows[0].content?.photos.kind, "checklist");
  }
  // Every photo flagged: neutral checklist note, the pack still completes.
  {
    const only: LoadedPhotos = { photos: [{ id: A, image: img }], total: 1 };
    const h = harness({ loaded: only, vision: () => ok(ranking([{ photo: 1, role: "lead", reason: "ok", flags: ["not_a_real_person_or_not_the_user"] }])) });
    await quiet(() => (async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; })());
    const photosSection = h.store.rows[0].content?.photos;
    assert.equal(photosSection?.kind, "checklist");
    assert.equal(photosSection?.note, FLAGGED_PHOTO_NOTE);
    assert.doesNotMatch(FLAGGED_PHOTO_NOTE, /flag|violat|explicit|minor|policy|against|reject/i, "no accusation in the pack");
    assert.equal(h.saved[0][0].flags[0], "not_a_real_person_or_not_the_user");
  }
  // Saving flags fails: the pack is not affected.
  {
    const h = harness({ loaded: three, vision: () => ok(rawRank), failSave: true });
    const { value } = await quiet(async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; });
    assert.deepEqual(value, { status: "ready" });
  }
  // Photos deleted / none: no vision call, no flags.
  {
    const h = harness({ loaded: { photos: [], total: 0 }, vision: () => ok(rawRank) });
    await quiet(() => (async () => { const c = await claimPack(h.deps, U1, "auto"); return "claim" in c ? executePack(h.deps, U1, c.claim) : c.outcome; })());
    assert.equal(h.requests.filter((r) => r.images).length, 0);
    assert.equal(h.saved.length, 0);
  }

  // ---------- user wording ----------
  assert.equal(USER_FLAG_NOTICE, "One photo can’t be used — please upload a different one.");
  assert.doesNotMatch(USER_FLAG_NOTICE, /flag|explicit|minor|sexual|violat|policy|fake|celebrity/i, "no accusation");

  // ---------- schema ----------
  const sql = read("../supabase/2026-11-20-photo-flags.sql");
  assert.match(sql, /add column if not exists deleted_at timestamptz/);
  assert.match(sql, /create table if not exists public\.photo_flags/);
  assert.match(sql, /alter table public\.photo_flags enable row level security/);
  assert.match(sql, /revoke all on public\.photo_flags from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on public\.photo_flags to service_role/);
  assert.doesNotMatch(sql, /grant [^;]*photo_flags to authenticated/i, "browsers never read why a photo was flagged");
  assert.match(sql, /deleted_at is null/, "the user's own-rows policy hides removed photos");
  assert.match(sql, /references public\.profile_photos \(id\) on delete cascade/);
  for (const kind of FLAG_KINDS) assert.ok(sql.includes(kind), `constraint allows ${kind}`);
  assert.doesNotMatch(sql, /drop table|drop column|delete from|truncate/i, "additive only");

  // ---------- wiring ----------
  const service = read("../src/lib/starter-pack/service.ts");
  assert.match(service, /saveFlags: \(id, verdicts\) => savePhotoVerdicts/, "the real deps store verdicts");
  assert.match(service, /livePhotoRows/, "soft-deleted photos never reach the model");
  const cron = read("../src/app/api/cron/starter-packs/route.ts");
  assert.match(cron, /searchParams\.get\("flags"\) === "1"/, "sweep through the existing route");
  assert.ok(cron.indexOf("if (!authorized(request))") < cron.indexOf("await sweepFlags"), "same bearer check first");
  assert.match(cron, /Math\.min\(6/, "small batches");
  const flagsServer = read("../src/lib/starter-pack/photo-flags.ts");
  assert.match(flagsServer, /FLAG_MODEL/, "the sweep uses the cheap classifier");
  assert.match(read("../src/lib/starter-pack/types.ts"), /FLAG_MODEL = "claude-haiku-5-5"/);
  assert.match(flagsServer, /budgetMs = 40_000/, "fits a 60 s function");
  assert.match(flagsServer, /ignore|not reviewed|unreviewed/i);
  assert.doesNotMatch(flagsServer, /console\.error\([^)]*(path|\.data|text)/, "no photo path or content in logs");
  const actions = read("../src/app/admin/clients/actions.ts");
  assert.match(actions, /decideFlaggedPhotoAction[\s\S]*adminEmailOrNull\(\)/, "admin session checked first");
  const clientsPage = read("../src/app/admin/clients/page.tsx");
  assert.match(clientsPage, /flagged=1/);
  assert.match(clientsPage, /Flagged/);
  const clientPage = read("../src/app/admin/clients/[id]/page.tsx");
  assert.match(clientPage, /decideFlaggedPhotoAction\.bind\(null, id, "approve"\)/);
  assert.match(clientPage, /decideFlaggedPhotoAction\.bind\(null, id, "remove"\)/);
  assert.match(clientPage, /flagLabel\(f\.flags\)/, "which photo and why");
  const manager = read("../src/components/app/photo-manager.tsx");
  assert.match(manager, /USER_FLAG_NOTICE/);
  const brief = read("../src/lib/automation/core.ts");
  assert.match(brief, /flagged\.has\(p\.id\)/, "flagged photos stay out of the concierge brief");
  console.log("photo flag checks ok");
}
void main();
