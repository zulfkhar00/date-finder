// Checks for the Reply helper: caps and limits, screenshot intake, output validation, prompts, and the generator's retry,
// refusal, cap, double-submit, regenerate and privacy behaviour. Uses a stub model and the in-memory store: no network, no
// database, and the real Anthropic API is never called.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PackError, type ModelRequest, type ModelResponse, type PackModel } from "../src/lib/starter-pack/generate";
import { classifyModelError } from "../src/lib/starter-pack/anthropic-model";
import { runReply, type ReplyDeps } from "../src/lib/reply-helper/generate";
import { DEFAULT_LIMITS, RUN_BUDGET_MS, backoffMs, decideRun, readLimits, weightedTokens } from "../src/lib/reply-helper/limits";
import { MAX_IMAGE_BYTES, cleanPasted, intakeImages, sniffImage } from "../src/lib/reply-helper/images";
import { REPLY_SYSTEM_PROMPT, buildReplyContext, buildReplyUserPrompt, isTweak } from "../src/lib/reply-helper/prompts";
import { MemoryReplyStore } from "../src/lib/reply-helper/store";
import { MAX_IMAGES, REPLY_MODEL, type ReplyContext, type ReplyInput, type ThreadRow } from "../src/lib/reply-helper/types";
import { checkReply } from "../src/lib/reply-helper/validate";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../src/lib/attribution";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const NOW = new Date("2026-11-21T12:00:00Z");
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const SECRET = "SECRET-CHAT-LINE-9f3a";

// ---- privacy spy: nothing the helper handles may reach a console ----
const logged: string[] = [];
for (const level of ["log", "info", "warn", "error", "debug"] as const) console[level] = ((...args: unknown[]) => { logged.push(args.map(String).join(" ")); }) as never;
const say = (line: string) => process.stdout.write(`${line}\n`);

// ---- fixtures ----
const ctx: ReplyContext = buildReplyContext({ first_name: "Zhanserik", birthday: "1996-04-12", gender: "man", interested_in: ["women"], city: "Almaty", job: "Nurse", interests: ["climbing", "ramen"], voice: "playful" }, ["Fair. Give me one thing that made today better and I'll match it."]);
const okJson = (over: Record<string, unknown> = {}) => JSON.stringify({
  status: "ok", language: "English", read: "She is warm and asking questions back. Good momentum.",
  transcript: [{ from: "them", text: "ramen at midnight is a crime" }, { from: "me", text: "Counterpoint: it's a sacrament" }],
  replies: [
    { angle: "Answer + ask", text: "Sacrament, and I'll defend it. What's your midnight food crime?" },
    { angle: "Tease", text: "Bold words from someone who has clearly never had good tonkotsu at 1am." },
    { angle: "Sincere", text: "Honestly it's how I decompress after a long shift. What do you do to unwind?" }],
  dateMove: { ready: true, line: "I'm enjoying this. Want to get coffee this week? Somewhere easy to leave if we hate each other.", plans: [
    { title: "Coffee and a walk", detail: "Saturday late morning at a quiet coffee place with outdoor seating, then a short walk. Public, easy to leave." },
    { title: "Ramen early evening", detail: "Thursday around 6pm at a casual ramen counter near the centre. Short, public, easy to wrap up." }] },
  ...over
});
const ok = (text: string, over: Partial<ModelResponse> = {}): ModelResponse => ({ text, inputTokens: 3000, outputTokens: 500, stopReason: "end_turn", ...over });

type Script = (request: ModelRequest, call: number) => ModelResponse | Error | Promise<ModelResponse>;
function stubModel(script: Script) {
  const requests: ModelRequest[] = [];
  const model: PackModel = { async complete(request) { requests.push(request); const out = await script(request, requests.length); if (out instanceof Error) throw out; return out; } };
  return { model, requests };
}
function harness(script: Script, over: Partial<ReplyDeps> = {}) {
  const store = new MemoryReplyStore();
  const { model, requests } = stubModel(script);
  const sleeps: number[] = [];
  const deps: ReplyDeps = { store, model, limits: DEFAULT_LIMITS, loadContext: async () => ctx, sleep: async (ms) => { sleeps.push(ms); }, now: () => NOW, ...over };
  return { deps, store, requests, sleeps };
}
const png = (n = 200) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47]); b[n - 1] = n % 251; return b; };
const jpg = (n = 200, tag = 1) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); b.fill(tag, 4); return b; };
const shots = (n = 2) => intakeImages(Array.from({ length: n }, (_, i) => jpg(300, i + 1)));
const newInput = (over: Partial<Extract<ReplyInput, { kind: "new" }>> = {}): ReplyInput => {
  const intake = shots(2);
  assert.ok(intake.ok);
  return { kind: "new", images: intake.images, text: "", ...over };
};

// ============ limits ============
assert.deepEqual(DEFAULT_LIMITS, { dailyCap: 150, tokenCap: 2_500_000, perUserPerDay: 20 });
assert.deepEqual(readLimits({}), DEFAULT_LIMITS);
assert.deepEqual(readLimits({ REPLY_HELPER_DAILY_CAP: "40", REPLY_HELPER_DAILY_TOKEN_CAP: "900000", REPLY_HELPER_PER_USER_PER_DAY: "5" }), { dailyCap: 40, tokenCap: 900000, perUserPerDay: 5 });
assert.deepEqual(readLimits({ REPLY_HELPER_DAILY_CAP: "abc", REPLY_HELPER_PER_USER_PER_DAY: "-3" }), DEFAULT_LIMITS, "bad env values fall back to the defaults");
assert.equal(weightedTokens(1000, 400), 3000);
assert.equal(backoffMs(1), 1500); assert.equal(backoffMs(2), 4000);
const idle = { runsToday: 0, tokensToday: 0, userRunsToday: 0, userInFlight: false };
assert.equal(decideRun(idle, DEFAULT_LIMITS), null);
assert.equal(decideRun({ ...idle, runsToday: 150 }, DEFAULT_LIMITS), "cap");
assert.equal(decideRun({ ...idle, tokensToday: 2_500_000 }, DEFAULT_LIMITS), "cap");
assert.equal(decideRun({ ...idle, userRunsToday: 20 }, DEFAULT_LIMITS), "user_limit");
assert.equal(decideRun({ ...idle, userRunsToday: 19 }, DEFAULT_LIMITS), null);
assert.equal(decideRun({ ...idle, userInFlight: true, userRunsToday: 20, runsToday: 999 }, DEFAULT_LIMITS), "busy", "a double submit is 'busy', whatever else is true");
say("ok limits");

// ============ screenshot intake ============
assert.equal(sniffImage(png()), "image/png"); assert.equal(sniffImage(jpg()), "image/jpeg");
assert.equal(sniffImage(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null, "gif is not accepted");
assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
const five = intakeImages(Array.from({ length: MAX_IMAGES + 1 }, (_, i) => jpg(100, i + 1)));
assert.ok(!five.ok && five.status === 400, "more than 4 files is refused");
const big = intakeImages([jpg(MAX_IMAGE_BYTES + 1)]);
assert.ok(!big.ok && big.status === 413);
const together = intakeImages([jpg(3_000_000, 1), jpg(3_000_000, 2)]);
assert.ok(!together.ok && together.status === 413, "the total body is bounded under the platform limit");
const bad = intakeImages([jpg(100), new Uint8Array([1, 2, 3, 4, 5])]);
assert.ok(!bad.ok && bad.status === 415);
const dup = intakeImages([jpg(500, 7), jpg(500, 7), jpg(500, 8)]);
assert.ok(dup.ok && dup.images.length === 2, "the same screenshot chosen twice is kept once");
const empty = intakeImages([new Uint8Array(0)]);
assert.ok(empty.ok && empty.images.length === 0);
const long = `${"old message. ".repeat(2000)}\nTHE LAST MESSAGE`;
const tail = cleanPasted(long, 500);
assert.ok(tail.length <= 500 && tail.endsWith("THE LAST MESSAGE"), "a long thread is cut from the START: the last messages are kept");
assert.equal(cleanPasted("a\u0000b\u0007c\r\nd", 100), "a b c\nd");
assert.equal(cleanPasted(42, 10), "");
say("ok intake");

// ============ output validation ============
const good = checkReply(okJson());
assert.ok(good.ok && good.drafts.replies.length === 3 && good.drafts.dateMove?.plans.length === 2 && good.transcript.length === 2);
assert.ok(checkReply(`Here you go:\n\`\`\`json\n${okJson()}\n\`\`\``).ok, "a code fence around the JSON is tolerated");
assert.deepEqual(checkReply(JSON.stringify({ status: "unreadable" })), { ok: false, kind: "unreadable" });
assert.deepEqual(checkReply(JSON.stringify({ status: "unsafe" })), { ok: false, kind: "unsafe" });
assert.equal((checkReply("not json at all") as { code?: string }).code, "bad_json");
assert.equal((checkReply(okJson({ replies: [{ angle: "a", text: "only one reply" }] })) as { code?: string }).code, "bad_shape");
const notReady = checkReply(okJson({ dateMove: { ready: false } }));
assert.ok(notReady.ok && notReady.drafts.dateMove === null, "no date move unless it is time");
const halfReady = checkReply(okJson({ dateMove: { ready: true, line: "Coffee?" } }));
assert.ok(halfReady.ok && halfReady.drafts.dateMove === null, "a date move without two plans is dropped, not shown half-done");
const four = JSON.parse(okJson());
four.replies.push({ angle: "Extra", text: "A fourth reply that should be trimmed away." });
const trimmed = checkReply(JSON.stringify(four));
assert.ok(trimmed.ok && trimmed.drafts.replies.length === 3);
assert.equal((checkReply(okJson({ replies: [{ angle: "x", text: "As an AI I think you should say hi" }, { angle: "y", text: "Second line here for you" }, { angle: "z", text: "Third line is different" }] })) as { code?: string }).code, "self_reveal");
assert.equal((checkReply(okJson({ replies: [{ angle: "x", text: "Send me a sexy photo" }, { angle: "y", text: "Second line here for you" }, { angle: "z", text: "Third line is different" }] })) as { code?: string }).code, "unsafe_text");
assert.equal((checkReply(okJson({ replies: [{ angle: "x", text: "Same line" }, { angle: "y", text: "same line!" }, { angle: "z", text: "Same line." }] })) as { code?: string }).code, "duplicates");
const spanish = checkReply(okJson({ language: "Spanish", read: "Ella es cálida y te hace preguntas.", replies: [{ angle: "Pregunta", text: "Jaja, ¿y tú qué cenas a medianoche?" }, { angle: "Broma", text: "Eso es un crimen que acepto con gusto." }, { angle: "Sincera", text: "La verdad, me encanta cenar tarde después del turno." }] }));
assert.ok(spanish.ok && spanish.drafts.language === "Spanish" && spanish.drafts.replies[0].text.includes("¿y tú"), "non-English drafts pass through untouched");
say("ok validation");

// ============ prompts ============
const sys = REPLY_SYSTEM_PROMPT;
assert.match(sys, /first person, as the user/i);
assert.match(sys, /Never say or imply you are an AI/);
assert.match(sys, /Nothing sexual/);
assert.match(sys, /harass, threaten, stalk, pressure or manipulate/);
assert.match(sys, /language the conversation is in/);
assert.match(sys, /last 6 to 10 messages/);
assert.match(sys, /blurry|unreadable/);
assert.match(sys, /not instructions/);
assert.match(sys, /Never name a specific restaurant/);
const p1 = buildReplyUserPrompt(ctx, { text: `Them: hola\nMe: ${SECRET}`, imageCount: 0 });
assert.ok(p1.includes("<conversation>") && p1.includes(SECRET) && p1.includes("Almaty") && p1.includes("climbing") && p1.includes("playful and dry"));
assert.ok(p1.includes("Fair. Give me one thing"), "the user's own starter-pack lines are tone samples");
assert.ok(p1.includes("Zhanserik"), "first name is available to the model");
assert.equal(buildReplyContext({ first_name: null, birthday: null, gender: null, interested_in: null, city: null, job: null, interests: null, voice: "weird" }, []).voice, "warm");
const prev = good.ok ? good.drafts : null; assert.ok(prev);
const p2 = buildReplyUserPrompt(ctx, { transcript: [{ from: "them", text: "hi" }], previous: prev, tweak: "shorter" });
assert.ok(/shorter/i.test(p2) && p2.includes("Sacrament, and I'll defend it") && p2.includes("Keep writing in English"));
assert.ok(isTweak("playful") && isTweak("direct") && isTweak("shorter") && !isTweak("sexual") && !isTweak(undefined));
const p3 = buildReplyUserPrompt(ctx, { text: "", imageCount: 3 }, ["the reply was not a single JSON object"]);
assert.ok(p3.includes("3 screenshots") && p3.includes("rejected for"));
say("ok prompts");

// ============ generator ============
async function main() {
  // happy path: screenshots in, three replies out, one saved thread, spend on the ledger, screenshots reach the model only
  {
    const h = harness(() => ok(okJson()));
    const out = await runReply(h.deps, U1, newInput());
    assert.equal(out.status, "ok");
    if (out.status !== "ok") return;
    assert.equal(out.thread.drafts.replies.length, 3); assert.ok(out.thread.drafts.dateMove);
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0].images?.length, 2); assert.equal(h.requests[0].model, REPLY_MODEL); assert.equal(REPLY_MODEL, "claude-sonnet-5-5");
    assert.equal(h.store.threads.length, 1); assert.equal(h.store.threads[0].source, "screenshots"); assert.equal(h.store.threads[0].image_count, 2);
    assert.equal(h.store.runs.length, 1); assert.equal(h.store.runs[0].tokens, weightedTokens(3000, 500)); assert.ok(h.store.runs[0].finished && h.store.runs[0].outcome === "ok");
    assert.ok(!JSON.stringify(h.store.threads).includes("base64"), "no image bytes are ever stored");
    assert.ok(!("images" in out.thread), "the view carries no transcript or image");
  }
  // pasted text, no images
  {
    const h = harness(() => ok(okJson()));
    const out = await runReply(h.deps, U1, { kind: "new", images: [], text: `Them: hi\nMe: ${SECRET}` });
    assert.equal(out.status, "ok"); assert.equal(h.requests[0].images?.length, 0); assert.equal(h.store.threads[0].source, "text");
    assert.ok(h.requests[0].user.includes(SECRET), "the pasted chat reaches the model");
  }
  // non-English chat: the prompt asks for the chat's language and the Spanish answer is kept
  {
    const h = harness(() => ok(okJson({ language: "Spanish", read: "Ella es cálida.", replies: [{ angle: "A", text: "Jaja, ¿y tú qué cenas?" }, { angle: "B", text: "Eso lo acepto con gusto." }, { angle: "C", text: "Me encanta cenar tarde." }] })));
    const out = await runReply(h.deps, U1, { kind: "new", images: [], text: "Ella: jaja ¿qué haces?\nYo: nada, cenando ramen" });
    assert.ok(out.status === "ok" && out.thread.drafts.language === "Spanish");
  }
  // blurry / unrelated screenshot: ask for a clearer one, save nothing, do not retry, still counts as a run
  {
    const h = harness(() => ok(JSON.stringify({ status: "unreadable" })));
    const out = await runReply(h.deps, U1, newInput());
    assert.deepEqual(out, { status: "unreadable" }); assert.equal(h.requests.length, 1); assert.equal(h.store.threads.length, 0);
    assert.equal(h.store.runs[0].outcome, "unreadable"); assert.ok(h.store.runs[0].finished);
  }
  // refusal (stop reason) and "unsafe" status: friendly refusal, no retry, nothing saved
  {
    const h = harness(() => ok("", { stopReason: "refusal" }));
    assert.deepEqual(await runReply(h.deps, U1, newInput()), { status: "refused" }); assert.equal(h.requests.length, 1); assert.equal(h.store.threads.length, 0);
    const h2 = harness(() => ok(JSON.stringify({ status: "unsafe" })));
    assert.deepEqual(await runReply(h2.deps, U1, newInput()), { status: "refused" }); assert.equal(h2.requests.length, 1); assert.equal(h2.store.runs[0].outcome, "unsafe");
  }
  // 429 twice, then fine: retried with backoff, one saved thread, all spend counted
  {
    const h = harness((_r, call) => call < 3 ? new PackError("rate_limited", true) : ok(okJson()));
    const out = await runReply(h.deps, U1, newInput());
    assert.equal(out.status, "ok"); assert.equal(h.requests.length, 3); assert.deepEqual(h.sleeps, [1500, 4000]); assert.equal(h.store.threads.length, 1);
  }
  // always 429 / timeout: friendly failure after three tries, run closed, no thread
  for (const code of ["rate_limited", "timeout", "overloaded"]) {
    const h = harness(() => new PackError(code, true));
    const out = await runReply(h.deps, U1, newInput());
    assert.deepEqual(out, { status: "failed", code }); assert.equal(h.requests.length, 3); assert.equal(h.store.threads.length, 0);
    assert.ok(h.store.runs[0].finished && h.store.runs[0].outcome === code);
  }
  // the real SDK errors map to those same codes
  assert.equal(classifyModelError({ status: 429 }).code, "rate_limited");
  assert.equal(classifyModelError({ name: "APIConnectionTimeoutError" }).code, "timeout");
  assert.equal(classifyModelError({ status: 529 }).retryable, true);
  assert.equal(classifyModelError({ status: 401 }).retryable, false);
  // no time left for another try: stop and fail friendly instead of letting the platform kill the request
  {
    let t = 0;
    const h = harness(() => { t += 30_000; return new PackError("timeout", true); }, { clock: () => t });
    const out = await runReply(h.deps, U1, newInput());
    assert.equal(out.status, "failed"); assert.equal(h.requests.length, 1, "30 s used, so a second 28 s call would not fit the 56 s budget"); assert.ok(RUN_BUDGET_MS <= 58_000);
  }
  // not retryable (bad key): one call
  {
    const h = harness(() => new PackError("unauthorized", false));
    assert.deepEqual(await runReply(h.deps, U1, newInput()), { status: "failed", code: "unauthorized" }); assert.equal(h.requests.length, 1);
  }
  // malformed answer: retried with the reason fed back; then fixed
  {
    const h = harness((_r, call) => call === 1 ? ok("sorry, here are some ideas") : call === 2 ? ok(okJson({ replies: [{ angle: "a", text: "As an AI, hello there friend" }, { angle: "b", text: "Another different line here" }, { angle: "c", text: "A third different line here" }] })) : ok(okJson()));
    const out = await runReply(h.deps, U1, newInput());
    assert.equal(out.status, "ok"); assert.equal(h.requests.length, 3);
    assert.match(h.requests[1].user, /rejected for: the reply was not a single JSON object/);
    assert.match(h.requests[2].user, /rejected for: a draft mentioned AI/);
  }
  // truncated answer retried; persistent garbage ends as a friendly failure
  {
    const h = harness((_r, call) => call === 1 ? ok("{", { stopReason: "max_tokens" }) : ok(okJson()));
    assert.equal((await runReply(h.deps, U1, newInput())).status, "ok"); assert.match(h.requests[1].user, /cut off/);
    const g = harness(() => ok("nope"));
    assert.deepEqual(await runReply(g.deps, U1, newInput()), { status: "failed", code: "bad_json" }); assert.equal(g.requests.length, 3);
  }
  // user gone / context failure: nothing claimed, nothing spent
  {
    const h = harness(() => ok(okJson()), { loadContext: async () => null });
    assert.deepEqual(await runReply(h.deps, U1, newInput()), { status: "failed", code: "user_gone" }); assert.equal(h.requests.length, 0); assert.equal(h.store.runs.length, 0);
  }
  // global daily cap: the model is never called
  {
    const h = harness(() => ok(okJson()), { limits: { ...DEFAULT_LIMITS, dailyCap: 2 } });
    assert.equal((await runReply(h.deps, U1, newInput())).status, "ok");
    assert.equal((await runReply(h.deps, U2, newInput())).status, "ok");
    assert.deepEqual(await runReply(h.deps, "33333333-3333-4333-8333-333333333333", newInput()), { status: "denied", reason: "cap" });
    assert.equal(h.requests.length, 2);
  }
  // token cap: a day that already spent the budget stops, even with runs to spare; failed runs are never refunded
  {
    const h = harness(() => new PackError("timeout", true), { limits: { ...DEFAULT_LIMITS, tokenCap: 20_000 } });
    await runReply(h.deps, U1, newInput()); // 3 failed tries still spend
    h.store.runs[0].tokens = 25_000; h.store.runs[0].finished = true;
    assert.deepEqual(await runReply(h.deps, U2, newInput()), { status: "denied", reason: "cap" });
  }
  // per-user 20 a day, other users unaffected, next day resets
  {
    let day = NOW;
    const h = harness(() => ok(okJson()), { now: () => day });
    for (let i = 0; i < 20; i++) assert.equal((await runReply(h.deps, U1, newInput())).status, "ok", `run ${i + 1}`);
    assert.deepEqual(await runReply(h.deps, U1, newInput()), { status: "denied", reason: "user_limit" });
    assert.equal((await runReply(h.deps, U2, newInput())).status, "ok");
    assert.equal(h.requests.length, 21);
    day = new Date("2026-11-22T00:10:00Z");
    assert.equal((await runReply(h.deps, U1, newInput())).status, "ok");
  }
  // double submit: while the first is in flight the second is refused ("busy") and costs nothing
  {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const h = harness(async () => { await gate; return ok(okJson()); });
    const first = runReply(h.deps, U1, newInput());
    await new Promise((r) => setTimeout(r, 5));
    const second = await runReply(h.deps, U1, newInput());
    assert.deepEqual(second, { status: "denied", reason: "busy" });
    release();
    assert.equal((await first).status, "ok"); assert.equal(h.requests.length, 1); assert.equal(h.store.runs.length, 1); assert.equal(h.store.threads.length, 1);
    assert.equal((await runReply(h.deps, U1, newInput())).status, "ok", "after it finishes the user can go again");
  }
  // regenerate / tweak: text only (no screenshot needed again), same thread, run counted, tweak stored
  {
    const h = harness(() => ok(okJson()));
    const first = await runReply(h.deps, U1, newInput());
    assert.ok(first.status === "ok");
    if (first.status !== "ok") return;
    const row = h.store.threads[0] as ThreadRow;
    const again = await runReply(h.deps, U1, { kind: "regenerate", thread: row, tweak: null });
    assert.ok(again.status === "ok" && again.thread.id === first.thread.id);
    assert.equal(h.requests[1].images?.length, 0, "regenerate sends no images");
    assert.ok(h.requests[1].user.includes("ramen at midnight is a crime"), "it works from the lines read the first time");
    const tweaked = await runReply(h.deps, U1, { kind: "tweak", thread: h.store.threads[0], tweak: "shorter" });
    assert.ok(tweaked.status === "ok" && tweaked.thread.tweak === "shorter");
    assert.equal(h.store.threads.length, 1); assert.equal(h.store.threads[0].runs, 3);
    assert.equal(h.store.runs.length, 3, "every rewrite counts against the daily limits");
    // someone else's thread cannot be overwritten
    const stolen = await runReply(h.deps, U2, { kind: "tweak", thread: h.store.threads[0], tweak: "direct" });
    assert.deepEqual(stolen, { status: "failed", code: "thread_gone" });
    assert.equal(h.store.threads[0].user_id, U1);
  }
  // a model that says "unreadable" on a rewrite is a hiccup, not the user's screenshot
  {
    const h = harness((_r, call) => call === 1 ? ok(okJson()) : ok(JSON.stringify({ status: "unreadable" })));
    await runReply(h.deps, U1, newInput());
    const out = await runReply(h.deps, U1, { kind: "regenerate", thread: h.store.threads[0], tweak: null });
    assert.equal(out.status, "failed");
  }
  // the helper works for any signed-in user: nothing in the path looks at country, payment or app status
  const reply = read("../src/app/api/app/reply/route.ts");
  const dir = new URL("../src/lib/reply-helper/", import.meta.url);
  const sources = readdirSync(dir).map((f) => ({ f, s: readFileSync(new URL(f, dir), "utf8") }));
  for (const { f, s } of sources.concat([{ f: "route.ts", s: reply }, { f: "copied.ts", s: read("../src/app/api/app/reply/copied/route.ts") }])) {
    assert.ok(!/paid-country|paid-access|country-review|x-vercel-ip-country|reservations/i.test(s), `${f} does not gate on country or payment`);
    assert.ok(!/console\.(log|info|warn|error|debug)/.test(s), `${f} never logs`);
    assert.ok(!/\.storage\b|NEXT_PUBLIC_/.test(s), `${f} stores no screenshot and reads no public env`);
  }
  assert.match(reply, /userOrNull\(\)/); assert.match(reply, /status: 401|, 401\)/);
  assert.ok(!/export const (MESSAGES|HEADERS|json)/.test(reply), "a route file exports only route fields");

  // events: whitelisted in code and in a migration that is a superset of the newest full list
  for (const e of ["reply_helper_used", "reply_copied"]) assert.ok((SERVER_EVENTS as readonly string[]).includes(e) && !(CLIENT_EVENTS as readonly string[]).includes(e), `${e} is server-recorded`);
  const sqlDir = new URL("../supabase/", import.meta.url);
  const list = (sql: string) => new Set([...(sql.match(/funnel_events_event_check\s+check \(event in \(([\s\S]*?)\)\);/)?.[1] ?? "").matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
  const previous = list(readFileSync(new URL("2026-11-20-paid-country-gate.sql", sqlDir), "utf8"));
  const mine = list(readFileSync(new URL("2026-11-21-reply-helper.sql", sqlDir), "utf8"));
  assert.ok(previous.size >= 30 && mine.size === previous.size + 2);
  for (const e of previous) assert.ok(mine.has(e), `migration keeps ${e}`);
  assert.ok(mine.has("reply_helper_used") && mine.has("reply_copied"));
  for (const e of [...CLIENT_EVENTS, ...SERVER_EVENTS]) assert.ok(mine.has(e), `every event name in code is allowed by the constraint: ${e}`);
  // the newest SQL file that defines the constraint is the one we copied from
  const definers = readdirSync(sqlDir).filter((f) => f.endsWith(".sql") && /funnel_events_event_check\s+check/.test(readFileSync(new URL(f, sqlDir), "utf8"))).sort();
  assert.equal(definers[definers.length - 1], "2026-11-21-reply-helper.sql");
  assert.ok(definers.includes("2026-11-20-paid-country-gate.sql"));

  // migration shape: idempotent, RLS on, browser roles revoked, own-read policy only
  const sql = readFileSync(new URL("2026-11-21-reply-helper.sql", sqlDir), "utf8");
  assert.match(sql, /create table if not exists public\.reply_threads/); assert.match(sql, /create table if not exists public\.reply_helper_runs/);
  assert.match(sql, /alter table public\.reply_threads enable row level security/); assert.match(sql, /alter table public\.reply_helper_runs enable row level security/);
  assert.match(sql, /revoke all on public\.reply_threads, public\.reply_helper_runs from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.reply_threads to authenticated/); assert.ok(!/grant[^;]*reply_helper_runs to authenticated/.test(sql));
  assert.match(sql, /drop policy if exists reply_threads_own_select[\s\S]*create policy reply_threads_own_select on public\.reply_threads for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.ok(!/create (table|index) (?!if not exists)/.test(sql), "every create is guarded");
  assert.ok(!/create policy (?!reply_threads_own_select)/.test(sql));
  assert.ok(!/\bto (anon|public)\b/.test(sql.replace(/from public, anon, authenticated/g, "")));

  // privacy: nothing the helper handled reached a console
  assert.deepEqual(logged.filter((l) => l.includes(SECRET) || l.includes("Almaty") || l.includes("ramen")), [], "no chat or profile text in logs");
  assert.deepEqual(logged, [], "the helper logs nothing at all");
  say("ok generator");
  say("reply-helper checks passed");
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exit(1); });
