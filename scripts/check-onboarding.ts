// Checks for the onboarding screen's pure logic and the consent idempotency guard. No network, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTION_TIMEOUT_MS, accountCopy, ageForCheckout, primaryLabel, mergeGuestBasics, parseGuestSaved, withTimeout } from "../src/lib/app/onboarding-flow";
import { draftFrom } from "../src/lib/app/draft";

async function main() {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.equal(ageForCheckout("2000-12-31", now), 25, "birthday later this year: not a year older yet");
  assert.equal(ageForCheckout("2000-11-13", now), 26, "birthday today");
  assert.equal(ageForCheckout("", now), undefined, "blank birthday: no age");
  assert.equal(ageForCheckout("2010-01-01", now), 18, "clamped to 18 (the form already blocks under-18)");
  assert.equal(ageForCheckout("1900-01-01", now), 99);

  assert.equal(parseGuestSaved(null), null);
  assert.equal(parseGuestSaved("not json"), null);
  assert.equal(parseGuestSaved('{"d":5}'), null);
  const saved = parseGuestSaved(JSON.stringify({ d: { firstName: "Sam", birthday: 7, gender: "man", interestedIn: ["women", 3] }, step: 1 }));
  assert.deepEqual([saved?.d.firstName, saved?.d.birthday, saved?.d.interestedIn, saved?.step], ["Sam", "", ["women"], 1], "bad fields are dropped, not trusted");

  const blank = draftFrom(null, null, []);
  assert.equal(mergeGuestBasics(blank, saved).firstName, "Sam", "a blank account gets the guest's answers back");
  assert.equal(mergeGuestBasics({ ...blank, firstName: "Alex" }, saved).firstName, "Alex", "answers already on the account win");
  assert.equal(mergeGuestBasics(blank, null), blank);

  assert.equal(primaryLabel("basics", true), "Continue", "the basics screen has a required birthday: never Skip");
  assert.equal(primaryLabel("about", true), "Skip for now");
  assert.equal(primaryLabel("about", false), "Continue");
  assert.equal(primaryLabel("consent", true), "Create my profiles");
  assert.notEqual(accountCopy(true).title, accountCopy(false).title, "the heading changes once the code is sent");
  assert.match(accountCopy(true).sub, /spam/i);

  assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
  await assert.rejects(withTimeout(new Promise(() => undefined), 20), /timeout/, "a save that never answers is cut off");
  assert.ok(ACTION_TIMEOUT_MS >= 10_000);

  const src = readFileSync(new URL("../src/lib/app/actions.ts", import.meta.url), "utf8");
  const consent = src.slice(src.indexOf("export async function giveConsent"));
  assert.match(consent, /\.eq\("version", CONSENT_VERSION\)/, "consent is recorded once per version");

  const flow = readFileSync(new URL("../src/app/onboarding/flow.tsx", import.meta.url), "utf8");
  assert.match(flow, /saving\.current/, "a second tap while a step is saving is ignored");
  assert.match(flow, /NETWORK_ERROR/, "a failed save shows a message");
  console.log("onboarding checks ok");
}
void main();
