// Checks for the per-network limit on sign-in code sends. No network, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEND_LIMIT, SEND_WINDOW_MS, createSendLimiter, networkKey, sendLimitMessage, trustedClientIp } from "../src/lib/app/code-send-limit";

const from = (h: Record<string, string>) => trustedClientIp(new Headers(h));
const t0 = Date.parse("2026-11-25T00:00:00Z");

// Allowed up to the limit, then blocked; other networks are untouched.
const limiter = createSendLimiter();
for (let i = 0; i < SEND_LIMIT; i++) assert.equal(limiter.take("203.0.113.9", t0 + i), 0, `send ${i + 1} goes out`);
assert.equal(limiter.take("203.0.113.9", t0 + 60_000), SEND_WINDOW_MS - 60_000, "the next one is refused, with the time left");
assert.equal(limiter.take("198.51.100.4", t0 + 60_000), 0, "another network is not affected");

// Window reset: refused tries do not push it back, and a full allowance returns.
assert.equal(limiter.take("203.0.113.9", t0 + SEND_WINDOW_MS - 1), 1, "still refused just before the reset");
for (let i = 0; i < SEND_LIMIT; i++) assert.equal(limiter.take("203.0.113.9", t0 + SEND_WINDOW_MS + i), 0, "allowed again after the window");
assert.ok(limiter.take("203.0.113.9", t0 + SEND_WINDOW_MS + SEND_LIMIT) > 0);

// A full table forgets the oldest window only.
const small = createSendLimiter(1, 1000, 2);
assert.equal(small.take("a", 0), 0);
assert.equal(small.take("b", 1), 0);
assert.equal(small.take("c", 2), 0);
assert.ok(small.take("b", 3) > 0, "a newer window survives");
assert.ok(small.take("c", 3) > 0);
assert.equal(small.take("a", 4), 0, "the oldest was dropped");

// Spoofed headers: only what the proxy wrote (the last X-Forwarded-For entry) counts.
assert.equal(from({ "x-forwarded-for": "203.0.113.9" }), "203.0.113.9", "Vercel: the single value it sets");
assert.equal(from({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }), "203.0.113.9", "a client-sent first entry is ignored");
assert.equal(from({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "1.2.3.4", "cf-connecting-ip": "5.6.7.8", "true-client-ip": "9.9.9.9" }), "203.0.113.9");
assert.equal(from({ "cf-connecting-ip": "5.6.7.8", "true-client-ip": "9.9.9.9" }), null, "headers no proxy of ours sets are not read");
assert.equal(from({ "x-real-ip": "203.0.113.9" }), "203.0.113.9", "fallback when there is no X-Forwarded-For");
assert.equal(from({ "x-forwarded-for": "203.0.113.9, junk", "x-real-ip": "1.2.3.4" }), null, "a malformed value is not swapped for another header");
assert.equal(from({}), null);
const spoof = createSendLimiter();
let refused = 0;
for (let i = 0; i < SEND_LIMIT + 5; i++) if (spoof.take(networkKey(from({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.9` })!), t0) > 0) refused++;
assert.equal(refused, 5, "rotating a fake header does not buy more sends");

// IPv6 counts per /64; an IPv4-mapped address is the IPv4 one.
assert.equal(networkKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), networkKey("2001:0DB8:0001:0002::1"));
assert.notEqual(networkKey("2001:db8:1:2::1"), networkKey("2001:db8:1:3::1"));
assert.equal(networkKey("2001:db8::1"), "2001:db8:0:0/64");
assert.equal(networkKey("::ffff:203.0.113.9"), "203.0.113.9");
assert.equal(networkKey("203.0.113.9"), "203.0.113.9");

assert.match(sendLimitMessage(61_000, false), /about 2 minutes\.$/);
assert.match(sendLimitMessage(1, false), /about 1 minute\.$/);
assert.match(sendLimitMessage(60_000, true), /enter the code we already sent/);

// Wiring: the limit is applied before an account is created or an email goes out, and both forms show the refusal.
const action = readFileSync(new URL("../src/app/login/actions.ts", import.meta.url), "utf8");
const at = (s: string) => { const i = action.indexOf(s); assert.ok(i > 0, `${s} is in the action`); return i; };
assert.ok(at("networkSends.take(") < at("auth.admin.createUser("));
assert.ok(at("networkSends.take(") < at("await sendAppEmail("));
for (const file of ["../src/app/login/login-form.tsx", "../src/app/onboarding/account-step.tsx"]) {
  const form = readFileSync(new URL(file, import.meta.url), "utf8");
  assert.equal(form.split("{sent.error ?").length - 1, 2, `${file}: the send error shows on the email and the code screen`);
}
console.log("send limit checks ok");
