// Self-check for src/lib/scrub.ts. Run with `npm test` (Node 22.18+ strips TypeScript types natively).
import assert from "node:assert/strict";
import { scrubDeep, scrubString } from "../src/lib/scrub.ts";

const token = "123456789:AAH-x_Yz0123456789abcdefABCDEF";

assert.equal(
  scrubString(`https://api.telegram.org/bot${token}/sendMessage`),
  "https://api.telegram.org/bot[redacted]/sendMessage"
);
assert.equal(scrubString(`fetch failed: bot${token}`), "fetch failed: bot[redacted]");
assert.equal(scrubString("mail me at a.b+c@example.com"), "mail me at [email]");
assert.equal(scrubString("/paid?session_id=cs_test_a1B2c3"), "/paid?session_id=[checkout_session]");
assert.equal(scrubString("robot 42 is fine"), "robot 42 is fine");

const event = {
  message: `POST https://api.telegram.org/bot${token}/sendMessage failed`,
  breadcrumbs: [{ data: { url: `https://api.telegram.org/bot${token}/getMe` } }],
  spans: [{ description: `GET /bot${token}/getUpdates`, data: { email: "x@y.co" } }],
  count: 3
};
assert.deepEqual(scrubDeep(event), {
  message: "POST https://api.telegram.org/bot[redacted]/sendMessage failed",
  breadcrumbs: [{ data: { url: "https://api.telegram.org/bot[redacted]/getMe" } }],
  spans: [{ description: "GET /bot[redacted]/getUpdates", data: { email: "[email]" } }],
  count: 3
});
assert.equal(JSON.stringify(scrubDeep(event)).includes(token), false);

console.log("scrub: all checks passed");
