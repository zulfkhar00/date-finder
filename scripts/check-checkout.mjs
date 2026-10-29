import assert from "node:assert/strict";
import { CHECKOUT_LINE_ITEM, checkoutPresentation, checkoutResponse, readCheckoutResponse } from "../src/lib/checkout-presentation.ts";

assert.equal(CHECKOUT_LINE_ITEM.name, "noswipe — reserve early access");
assert.match(CHECKOUT_LINE_ITEM.description, /refundable early-access waitlist fee/i);
assert.match(CHECKOUT_LINE_ITEM.description, /does not start a service/i);
assert.equal(/activates|matches|dates/i.test(CHECKOUT_LINE_ITEM.description), false, "line item never promises service or outcomes");

const origin = "https://www.noswipe.app";
const publicKey = "pk_test_example";
const embedded = checkoutPresentation("embedded", publicKey, origin);
assert.equal(embedded.params.ui_mode, "embedded_page");
assert.equal(embedded.params.redirect_on_completion, "if_required");
assert.equal(embedded.params.return_url, `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`);
assert.equal("success_url" in embedded.params, false);
assert.equal("cancel_url" in embedded.params, false);

for (const [mode, key] of [[undefined, publicKey], ["hosted", publicKey], ["embedded", undefined], ["embedded", "rk_live_notpublic"]]) {
  const hosted = checkoutPresentation(mode, key, origin);
  assert.equal(hosted.mode, "hosted");
  assert.equal(hosted.params.success_url, `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(hosted.params.cancel_url, `${origin}/reserve?cancelled=1`);
  assert.equal("return_url" in hosted.params, false);
  assert.equal("redirect_on_completion" in hosted.params, false);
}

const session = { id: "cs_test_example123", url: null, client_secret: "cs_test_example123_secret_example" };
assert.deepEqual(readCheckoutResponse(checkoutResponse(session, embedded)), { mode: "embedded", sessionId: session.id, clientSecret: session.client_secret, publishableKey: publicKey });
assert.throws(() => checkoutResponse({ ...session, client_secret: null }, embedded), /secret/);
assert.throws(() => checkoutResponse(session, checkoutPresentation(undefined, publicKey, origin)), /URL/);
assert.deepEqual(readCheckoutResponse({ url: "https://checkout.stripe.com/example" }), { mode: "hosted", url: "https://checkout.stripe.com/example" });
for (const response of [null, {}, { url: "javascript:alert(1)" }, { mode: "embedded", sessionId: session.id, clientSecret: "other-session-secret", publishableKey: publicKey }]) {
  assert.throws(() => readCheckoutResponse(response), /could not open/);
}
console.log("checkout: embedded redirects, legacy compatibility and invalid responses passed");
