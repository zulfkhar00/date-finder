// Self-check for src/lib/confirmation-email.ts. Run with `npm test`.
import assert from "node:assert/strict";
import { buildConfirmationEmail } from "../src/lib/confirmation-email.ts";
import { buildAdminLoginEmail } from "../src/lib/admin-login-email.ts";

const email = buildConfirmationEmail();
assert.equal(email.subject, "You're in — your spot is reserved");
for (const body of [email.text, email.html]) {
  assert.ok(body.includes("You're in — your spot is reserved."));
  assert.equal(/#[0-9]+ in|in the queue|queue position/i.test(body), false, "never show the queue number");
  assert.ok(body.includes("You're on the early-access list."));
  assert.ok(body.includes("Sign in at noswipe.app to see your profile and your apps."));
  assert.ok(body.includes("You can pause any app or take over any chat from the app at any time."));
  assert.equal(/batch|nonrefundable/i.test(body), false, "no batch or nonrefundable wording");
  assert.ok(body.includes("Nothing to do until then."));
  assert.ok(body.includes("https://noswipe.app"));
  assert.ok(body.includes("reply to this email"));
  assert.ok(body.includes("early-access"));
}
assert.ok(email.html.includes('href="https://noswipe.app"'));
assert.ok(email.html.includes('src="https://www.noswipe.app/brand/email-logo.png"'), "logo in the header");

// Founder sign-in email (/admin/login): NoSwipe-branded, link + code, nothing from Supabase.
const link = "https://www.noswipe.app/admin/auth/callback?token_hash=abc123&type=email";
const login = buildAdminLoginEmail(link, "12345678");
assert.equal(login.subject, "Your NoSwipe admin sign-in");
for (const body of [login.text, login.html]) {
  assert.ok(body.includes("Sign in to NoSwipe admin."));
  assert.ok(body.includes("12345678"), "the one-time code");
  assert.ok(body.includes("expire in 1 hour"));
  assert.equal(/supabase/i.test(body), false, "no Supabase branding");
}
assert.ok(login.text.includes(link));
assert.ok(login.html.includes('href="https://www.noswipe.app/admin/auth/callback?token_hash=abc123&amp;type=email"'), "escaped link");
assert.ok(login.html.includes('src="https://www.noswipe.app/brand/email-logo.png"'), "logo in the header");
assert.equal(buildAdminLoginEmail('https://x.test/"><script>', "1").html.includes("<script>"), false, "escapes the link");

console.log("email: all checks passed");
