// Self-check for src/lib/confirmation-email.ts. Run with `npm test`.
import assert from "node:assert/strict";
import { buildConfirmationEmail } from "../src/lib/confirmation-email.ts";

const email = buildConfirmationEmail(42);
assert.equal(email.subject, "You're #42 in line at NoSwipe");
for (const body of [email.text, email.html]) {
  assert.ok(body.includes("You're in."));
  assert.ok(body.includes("#42"));
  assert.ok(body.includes("in the queue"));
  assert.ok(body.includes("we'll email you when your batch starts"));
  assert.ok(body.includes("Nothing to do until then."));
  assert.ok(body.includes("https://noswipe.app"));
  assert.ok(body.includes("reply to this email"));
  assert.equal(/waitlist/i.test(body), false, "no waitlist wording");
}
assert.ok(email.html.includes('href="https://noswipe.app"'));
for (const bad of [0, -1, 1.5, Number.NaN]) assert.throws(() => buildConfirmationEmail(bad));

console.log("email: all checks passed");
