// Checks for the onboarding screen's pure logic and the consent idempotency guard. No network, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTION_TIMEOUT_MS, PENDING_CODE_TTL_MS, parsePendingCode, pendingCodeValue, accountCopy, ageForCheckout, primaryLabel, mergeGuestBasics, parseGuestSaved, withTimeout } from "../src/lib/app/onboarding-flow";
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

  const sentAt = now.getTime();
  assert.equal(parsePendingCode(pendingCodeValue("sam@example.test", sentAt), sentAt + 60_000), "sam@example.test", "a reload after the mail app comes back to the code field");
  assert.equal(parsePendingCode(pendingCodeValue("sam@example.test", sentAt), sentAt + PENDING_CODE_TTL_MS), null, "an expired code is not offered again");
  for (const bad of [null, "", "nope", "{}", '{"email":5,"at":1}', '{"email":"x","at":1}', '{"email":"a@b.co"}']) assert.equal(parsePendingCode(bad, sentAt), null, String(bad));

  assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
  await assert.rejects(withTimeout(new Promise(() => undefined), 20), /timeout/, "a save that never answers is cut off");
  assert.ok(ACTION_TIMEOUT_MS >= 10_000);

  const src = readFileSync(new URL("../src/lib/app/actions.ts", import.meta.url), "utf8");
  const consent = src.slice(src.indexOf("export async function giveConsent"));
  assert.match(consent, /\.eq\("version", CONSENT_VERSION\)/, "consent is recorded once per version");

  const flow = readFileSync(new URL("../src/app/onboarding/flow.tsx", import.meta.url), "utf8");
  assert.match(flow, /saving\.current/, "a second tap while a step is saving is ignored");
  assert.match(flow, /NETWORK_ERROR/, "a failed save shows a message");
  // The answer chips on the first screen share app.css with the whole app. A second `.app-chip` rule added for another
  // component once turned every unpicked answer into white text on white, so one class name has one top-level rule.
  const css = readFileSync(new URL("../src/app/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = new Map<string, string[]>();
  let depth = 0, buffer = "", open: string[] = [];
  for (const ch of css) {
    if (ch === "{") { if (depth === 0) open = buffer.split(",").map((s) => s.trim()); depth += 1; buffer = ""; }
    else if (ch === "}") { depth -= 1; if (depth === 0) for (const s of open) if (/^\.[a-z0-9-]+$/i.test(s)) rules.set(s, [...(rules.get(s) ?? []), buffer]); buffer = ""; }
    else buffer += ch;
  }
  assert.deepEqual([...rules].filter(([, bodies]) => bodies.length > 1).map(([name]) => name), [], "a class is styled by two top-level rules in app.css: the later one silently restyles the earlier component");
  const chip = rules.get(".app-chip")?.[0] ?? "";
  assert.match(chip, /background:var\(--card\)/, "answer chips sit on the card colour");
  assert.doesNotMatch(chip, /(^|;)color:#fff/, "an unpicked answer chip must not be white on white");
  const account = readFileSync(new URL("../src/app/onboarding/account-step.tsx", import.meta.url), "utf8");
  assert.match(account, /useActionState<LoginState, FormData>\(requestCode, initial\)/, "the code screen can be restored");
  assert.match(account, /restart=\{\(\) => \{ forgetPendingCode\(\)/, "Change email forgets the old address");
  assert.match(css, /\.ob-foot\{position:sticky;bottom:0/, "the main button stays on screen on phones");
  assert.match(flow, /ob-foot[^\n]*\n\s*\{error \?/, "a save error sits next to the button, not under the sticky footer");
  console.log("onboarding checks ok");
}
void main();
