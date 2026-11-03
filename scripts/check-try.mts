// Checks for the free /try tool: input validation, rate-limit and cap logic, and an API smoke test
// with a mocked Anthropic client (no network, no database). Run with `npm test`.
import assert from "node:assert/strict";
import { draft, type DraftClient } from "../src/lib/concierge/draft";
import { handleTryRequest, modelNeverRan, type TryDeps } from "../src/lib/try/handler";
import { DEFAULT_LIMITS, MemoryRunStore, decideClaim, hashIdentifier, ipKey, readLimits, utcDay, weightedTokens } from "../src/lib/try/limits";
import { sniffImageType, validateFields, validateImages } from "../src/lib/try/validate";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const SID = "11111111-2222-4333-8444-555555555555";

// --- validation -------------------------------------------------------------------------------
assert.equal(sniffImageType(PNG), "image/png");
assert.equal(sniffImageType(JPEG), "image/jpeg");
assert.equal(sniffImageType(new TextEncoder().encode("RIFFxxxxWEBPVP8 ")), "image/webp");
assert.equal(sniffImageType(new TextEncoder().encode("GIF89a....")), "image/gif");
assert.equal(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
assert.equal(sniffImageType(new TextEncoder().encode("%PDF-1.7")), null);

const fieldsOf = (values: Record<string, string>) => validateFields((name) => values[name] ?? null);
const good = fieldsOf({ kind: "opener", app: "Hinge", sessionId: SID, about: '  hi """ there  ' });
assert.ok(good.ok);
if (good.ok) {
  assert.equal(good.about, 'hi " there', "about is trimmed and quote fences collapsed");
  assert.equal(good.funnelSessionId, null);
}
assert.equal(fieldsOf({ kind: "date_plan", app: "Hinge", sessionId: SID }).ok, false, "unknown kind rejected");
assert.equal(fieldsOf({ kind: "reply", app: "Grindr", sessionId: SID }).ok, false, "unknown app rejected");
assert.equal(fieldsOf({ kind: "reply", app: "Tinder", sessionId: "nope" }).ok, false, "bad session id rejected");
assert.equal(fieldsOf({ kind: "reply", app: "Tinder", sessionId: SID, about: "x".repeat(601) }).ok, false, "long note rejected");

const file = (bytes: Uint8Array, size = bytes.length) => ({ size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
assert.equal((await validateImages([], "profile")).ok, false, "no images");
assert.equal((await validateImages(Array.from({ length: 7 }, () => file(PNG)), "profile")).ok, false, "more than 6 images");
assert.equal((await validateImages(Array.from({ length: 6 }, () => file(PNG)), "profile")).ok, true, "6 images ok for profile");
assert.equal((await validateImages(Array.from({ length: 4 }, () => file(PNG)), "reply")).ok, false, "chat takes at most 3");
assert.equal((await validateImages([file(PNG, 5 * 1024 * 1024 + 1)], "profile")).ok, false, "over 5 MB");
assert.equal((await validateImages([file(new TextEncoder().encode("not an image"))], "profile")).ok, false, "non-image bytes");
const accepted = await validateImages([file(JPEG), file(PNG)], "profile");
assert.ok(accepted.ok);
if (accepted.ok) assert.deepEqual(accepted.images.map((image) => image.mediaType), ["image/jpeg", "image/png"]);

// --- limits -------------------------------------------------------------------------------------
const limits = { sessionPerDay: 3, ipPerDay: 4, dailyCap: 5, tokenCap: 1000 };
assert.equal(decideClaim({ session: 3, ip: 0, daily: 0 }, limits), "session");
assert.equal(decideClaim({ session: 0, ip: 4, daily: 0 }, limits), "ip");
assert.equal(decideClaim({ session: 0, ip: 0, daily: 5 }, limits), "cap");
assert.equal(decideClaim({ session: 2, ip: 3, daily: 4 }, limits), null);
assert.deepEqual(readLimits({}), DEFAULT_LIMITS);
assert.equal(DEFAULT_LIMITS.dailyCap, 300);
assert.deepEqual(readLimits({ TRY_DAILY_CAP: "50", TRY_SESSION_DAILY_LIMIT: "abc", TRY_IP_DAILY_LIMIT: "-2", TRY_DAILY_TOKEN_CAP: "999" }), { ...DEFAULT_LIMITS, dailyCap: 50, tokenCap: 999 });
assert.equal(decideClaim({ session: 0, ip: 0, daily: 0, tokens: 1000 }, limits), "cap", "token cap");
assert.equal(weightedTokens(1000, 100), 1500);

// IPv6 is keyed by its /64, so rotating the interface id does not dodge the limit.
assert.equal(ipKey("203.0.113.9"), "203.0.113.9");
assert.equal(ipKey("::ffff:203.0.113.9"), "203.0.113.9");
assert.equal(ipKey("2001:db8:abcd:12:aaaa:bbbb:cccc:dddd"), ipKey("2001:0db8:abcd:0012::1"));
assert.notEqual(ipKey("2001:db8:abcd:12::1"), ipKey("2001:db8:abcd:13::1"));
assert.equal(ipKey("2001:db8:abcd:12::1"), "2001:db8:abcd:12::/64");
assert.equal(ipKey("unknown"), "unknown");

// Only runs where the model certainly did not run are given back.
assert.equal(modelNeverRan(Object.assign(new Error("x"), { status: 529 })), true);
assert.equal(modelNeverRan(Object.assign(new Error("x"), { status: 429 })), true);
assert.equal(modelNeverRan(Object.assign(new Error("x"), { status: 408 })), true);
assert.equal(modelNeverRan(Object.assign(new Error("x"), { name: "APIConnectionError" })), true);
assert.equal(modelNeverRan(Object.assign(new Error("x"), { status: 400 })), false);
assert.equal(modelNeverRan(new Error("Draft returned no structured output (stop_reason: max_tokens)")), false);
assert.equal(hashIdentifier("1.2.3.4", "salt", "2026-11-02"), hashIdentifier("1.2.3.4", "salt", "2026-11-02"));
assert.notEqual(hashIdentifier("1.2.3.4", "salt", "2026-11-02"), hashIdentifier("1.2.3.4", "salt", "2026-11-03"), "hashes differ per day");
assert.notEqual(hashIdentifier("1.2.3.4", "salt", "2026-11-02"), hashIdentifier("1.2.3.4", "other", "2026-11-02"), "hashes differ per salt");
assert.ok(!hashIdentifier("1.2.3.4", "salt", "2026-11-02").includes("1.2.3.4"));
assert.equal(utcDay(new Date("2026-11-02T23:59:59Z")), "2026-11-02");

const memory = new MemoryRunStore();
const claim = (session: string, ip: string, day = "2026-11-02", l = limits) => memory.claim({ ipHash: ip, sessionHash: session, kind: "reply", day, limits: l });
const first = await claim("s1", "ip1");
assert.ok(first.allowed && first.sessionRemaining === 2);
assert.ok((await claim("s1", "ip1")).allowed);
assert.ok((await claim("s1", "ip1")).allowed);
const fourth = await claim("s1", "ip1");
assert.ok(!fourth.allowed && fourth.reason === "session", "3 runs per session per day");
if (first.allowed) {
  await memory.release(first.runId);
  assert.ok((await claim("s1", "ip1")).allowed, "a released run is given back");
}
assert.ok((await claim("s2", "ip1")).allowed, "4th run from this ip");
const ipBlocked = await claim("s3", "ip1");
assert.ok(!ipBlocked.allowed && ipBlocked.reason === "ip", "ip limit across sessions");
assert.ok((await claim("s4", "ip2")).allowed, "5th run overall");
const capped = await claim("s5", "ip3");
assert.ok(!capped.allowed && capped.reason === "cap", "global daily cap");
assert.ok((await claim("s1", "ip1", "2026-11-03")).allowed, "a new UTC day resets everything");

// Spend is never refunded: releasing a run keeps its tokens against the daily token cap.
const spend = new MemoryRunStore();
const spendLimits = { sessionPerDay: 9, ipPerDay: 9, dailyCap: 9, tokenCap: 100 };
const spent = await spend.claim({ ipHash: "i", sessionHash: "s", kind: "reply", day: "2026-11-02", limits: spendLimits });
assert.ok(spent.allowed);
if (spent.allowed) {
  await spend.recordUsage(spent.runId, 100);
  await spend.release(spent.runId);
}
const afterSpend = await spend.claim({ ipHash: "i2", sessionHash: "s2", kind: "reply", day: "2026-11-02", limits: spendLimits });
assert.ok(!afterSpend.allowed && afterSpend.reason === "cap", "token cap holds even after release");

// --- API smoke test with a mocked Anthropic client ------------------------------------------------
type ParseArgs = Parameters<DraftClient["messages"]["parse"]>[0];
const calls: ParseArgs[] = [];
let failNext: null | "status" | "truncated" | "refusal" = null;
const fixtures: Record<string, unknown> = {
  opener: { input_summary: "A profile.", openers: [1, 2, 3].map((n) => ({ text: `opener ${n}`, references: "her dog" })), operator_flags: [] },
  profile: { input_summary: "Two photos.", photo_ranking: [{ photo: 1, verdict: "LEAD", reason: "clear face" }, { photo: 2, verdict: "cut", reason: "blurry" }], per_app: [{ app: "Hinge", bio: "bio text", prompts: [{ prompt: "I go crazy for", answer: "tacos" }] }], settings_to_change: [], operator_flags: [] },
  reply: { input_summary: "A chat.", read: "Going well", warmth: "warm", reply: "r1", alternative: "r2", ask_out_now: true, date_ask: "coffee?", respect_note: null, operator_flags: [] }
};
const mock: DraftClient = {
  messages: {
    parse: (async (args: ParseArgs) => {
      calls.push(args);
      if (failNext === "status") { failNext = null; throw Object.assign(new Error("upstream boom"), { status: 529 }); }
      if (failNext === "truncated") { failNext = null; return { parsed_output: null, stop_reason: "max_tokens", usage: { input_tokens: 4000, output_tokens: 4000 } }; }
      if (failNext === "refusal") { failNext = null; return { parsed_output: null, stop_reason: "refusal", usage: { input_tokens: 4000, output_tokens: 10 } }; }
      const text = JSON.stringify(args.messages);
      const kind = text.includes("Write the opener") ? "opener" : text.includes("Write the profile") ? "profile" : "reply";
      return { parsed_output: fixtures[kind], stop_reason: "end_turn", usage: { input_tokens: 5000, output_tokens: 800 } };
    }) as unknown as DraftClient["messages"]["parse"]
  }
};

const recorded: string[] = [];
const errors: string[] = [];
const logged: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };

function deps(overrides: Partial<TryDeps> = {}): TryDeps {
  return {
    store: new MemoryRunStore(),
    draft: (input) => draft(input, { client: mock }),
    salt: "test-salt",
    limits: { sessionPerDay: 3, ipPerDay: 6, dailyCap: 300, tokenCap: 8_000_000 },
    recordResult: ({ kind }) => { recorded.push(kind); },
    reportError: (label, status) => { errors.push(`${label}:${status ?? ""}`); },
    ...overrides
  };
}

function request(kind: string, options: { session?: string; ip?: string; images?: Uint8Array[]; origin?: string } = {}) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("app", "Hinge");
  form.set("sessionId", options.session ?? SID);
  form.set("about", "I climb on weekends");
  for (const bytes of options.images ?? [PNG]) form.append("images", new File([bytes as BlobPart], "x.png", { type: "image/png" }));
  const headers: Record<string, string> = { "x-real-ip": options.ip ?? "203.0.113.9" };
  if (options.origin) headers.origin = options.origin;
  return new Request("https://noswipe.app/api/try", { method: "POST", body: form, headers });
}

const shared = deps();
for (const kind of ["opener", "profile", "reply"] as const) {
  const response = await handleTryRequest(request(kind, { session: crypto.randomUUID(), images: kind === "profile" ? [JPEG, PNG] : [PNG] }), shared);
  assert.equal(response.status, 200, kind);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.kind, kind);
  assert.equal(body.result.kind, kind);
  assert.equal("message" in body.result, false, "formatted concierge message is not exposed");
  assert.equal("input_summary" in body.result, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
}
assert.deepEqual(recorded, ["opener", "profile", "reply"], "try_result recorded once per successful run");

const profileCall = calls[1];
assert.equal(profileCall.model, "claude-sonnet-5-5");
assert.match(String(profileCall.system), /free self-serve tool/);
assert.doesNotMatch(String(profileCall.system), /operator reviews every draft/);
assert.match(String(profileCall.system), /I climb on weekends/);
assert.equal(JSON.stringify(profileCall.messages).split('"type":"image"').length - 1, 2, "both photos reach the model");
const normalized = await (await handleTryRequest(request("profile", { session: crypto.randomUUID() }), shared)).json();
assert.equal(normalized.result.photo_ranking[0].verdict, "lead", "verdicts are normalised by the shared draft code");

// Per-session limit (3/day) and friendly message.
const limited = deps();
const session = crypto.randomUUID();
for (let i = 0; i < 3; i += 1) assert.equal((await handleTryRequest(request("reply", { session, ip: `198.51.100.${i}` }), limited)).status, 200);
const blocked = await handleTryRequest(request("reply", { session, ip: "198.51.100.77" }), limited);
assert.equal(blocked.status, 429);
const blockedBody = await blocked.json();
assert.equal(blockedBody.code, "daily_limit");
assert.match(blockedBody.message, /tomorrow/);

// Global cap.
const capDeps = deps({ limits: { sessionPerDay: 3, ipPerDay: 6, dailyCap: 1, tokenCap: 8_000_000 } });
assert.equal((await handleTryRequest(request("reply", { session: crypto.randomUUID() }), capDeps)).status, 200);
const capResponse = await handleTryRequest(request("reply", { session: crypto.randomUUID(), ip: "192.0.2.5" }), capDeps);
assert.equal(capResponse.status, 429);
assert.equal((await capResponse.json()).code, "capacity");

// Bad input never reaches the model or uses a run.
const before = calls.length;
const txt = new FormData();
txt.set("kind", "reply"); txt.set("app", "Tinder"); txt.set("sessionId", SID);
txt.append("images", new File(["hello"], "a.png", { type: "image/png" }));
const rejected = await handleTryRequest(new Request("https://noswipe.app/api/try", { method: "POST", body: txt }), deps());
assert.equal(rejected.status, 400);
assert.equal(calls.length, before, "model not called for invalid input");
const tooMany = await handleTryRequest(request("profile", { images: Array.from({ length: 7 }, () => PNG) }), deps());
assert.equal(tooMany.status, 400);

// Model never ran (upstream 529): friendly error, the run is given back, nothing from the request is reported or logged.
const flaky = deps();
const flakySession = crypto.randomUUID();
failNext = "status";
const failed = await handleTryRequest(request("reply", { session: flakySession }), flaky);
assert.equal(failed.status, 502);
assert.match((await failed.json()).message, /wasn't counted/);
assert.deepEqual(errors, ["try_draft_failed:529"]);
for (let i = 0; i < 3; i += 1) assert.equal((await handleTryRequest(request("reply", { session: flakySession }), flaky)).status, 200, "a 529 did not use up a try");

// Truncated or refused output: the model ran, so the try stays counted.
for (const mode of ["truncated", "refusal"] as const) {
  const burn = deps();
  const burnSession = crypto.randomUUID();
  failNext = mode;
  const bad = await handleTryRequest(request("reply", { session: burnSession }), burn);
  assert.equal(bad.status, 502, mode);
  assert.doesNotMatch((await bad.json()).message, /wasn't counted/);
  assert.equal((await handleTryRequest(request("reply", { session: burnSession }), burn)).status, 200);
  assert.equal((await handleTryRequest(request("reply", { session: burnSession }), burn)).status, 200);
  assert.equal((await handleTryRequest(request("reply", { session: burnSession }), burn)).status, 429, `${mode} counted against the session limit`);
}

// Daily token cap: failed-but-costly runs burn it and releases never give it back.
const budget = deps({ limits: { sessionPerDay: 9, ipPerDay: 9, dailyCap: 300, tokenCap: 20_000 } });
failNext = "truncated";
await handleTryRequest(request("reply", { session: crypto.randomUUID(), ip: "198.18.0.1" }), budget);
failNext = "status";
await handleTryRequest(request("reply", { session: crypto.randomUUID(), ip: "198.18.0.2" }), budget);
const overBudget = await handleTryRequest(request("reply", { session: crypto.randomUUID(), ip: "198.18.0.3" }), budget);
assert.equal(overBudget.status, 429);
assert.equal((await overBudget.json()).code, "capacity", "spend cap stops new runs");

// Fail closed: if the claim store errors, nothing reaches the model.
const callsBefore = calls.length;
const closed = await handleTryRequest(request("reply", { session: crypto.randomUUID() }), deps({ store: { claim: async () => { throw new Error("db down"); }, release: async () => undefined, recordUsage: async () => undefined } }));
assert.equal(closed.status, 503);
assert.equal((await closed.json()).code, "unavailable");
assert.equal(calls.length, callsBefore, "model not called when the limit store is down");

// Oversized requests are refused with a clear message before parsing.
const huge = new Request("https://noswipe.app/api/try", { method: "POST", body: "x", headers: { "content-length": "4600000" } });
const hugeResponse = await handleTryRequest(huge, deps());
assert.equal(hugeResponse.status, 413);
assert.match((await hugeResponse.json()).message, /too big/);

// Localhost / preview origins are not recorded in the funnel.
const before2 = recorded.length;
await handleTryRequest(request("reply", { session: crypto.randomUUID(), origin: "http://localhost:3000" }), deps({ shouldRecord: (origin) => !origin?.includes("localhost") }));
assert.equal(recorded.length, before2);

console.error = originalError;
const everything = JSON.stringify([errors, logged]);
assert.ok(!everything.includes("iVBOR") && !everything.includes("climb"), "no image or note content in logs or error reports");

console.log("try: validation, limits and API smoke checks passed");
