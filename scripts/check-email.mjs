// Self-check for src/lib/confirmation-email.ts. Run with `npm test`.
import assert from "node:assert/strict";
import { buildConfirmationEmail } from "../src/lib/confirmation-email.ts";

const email = buildConfirmationEmail();
assert.equal(email.subject, "Thanks! We're reviewing your NoSwipe application");
for (const body of [email.text, email.html]) {
  assert.ok(body.includes("Thanks for applying to NoSwipe."));
  assert.ok(body.includes("reviewing your application"));
  assert.equal(/#[0-9]+ in|in the queue|queue position/i.test(body), false, "never show the queue number");
  assert.ok(body.includes("we'll email you as soon as your batch is ready"));
  assert.ok(body.includes("Nothing to do until then."));
  assert.ok(body.includes("https://noswipe.app"));
  assert.ok(body.includes("reply to this email"));
  assert.equal(/waitlist/i.test(body), false, "no waitlist wording");
}
assert.ok(email.html.includes('href="https://noswipe.app"'));
assert.ok(email.html.includes('src="https://www.noswipe.app/brand/email-logo.png"'), "logo in the header");

console.log("email: all checks passed");
