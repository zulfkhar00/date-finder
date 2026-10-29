import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function publicCopyFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    if (["admin", "api"].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return publicCopyFiles(path);
    return /\.(?:tsx?|json)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

const files = (await Promise.all(["src/app", "src/components", "src/content"].map(publicCopyFiles))).flat();

const contents = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])));
const publicCopy = Object.values(contents).join("\n");

// Target positive service promises, while allowing boundary copy such as
// "we do not swipe" and instructions that the user swipes or sends.
const forbiddenOperationPromises = [
  /we (?:swipe|chat|book)(?:\b|\.)/i,
  /(?:we|NoSwipe) (?:will|can) (?:log in|access|operate|run|control|swipe|like|send|message|chat|book|confirm)\b/i,
  /(?:we|NoSwipe) (?:log into|access|operate|run|control|manage) (?:your|the|users?['’]?) (?:dating[- ]app |Tinder |Bumble |Hinge )?accounts?/i,
  /NoSwipe (?:logs in|accesses|operates|runs|controls|swipes|likes|sends|messages|chats|books|confirms)\b/i,
  /NoSwipe runs your/i,
  /swipes? done for you/i,
  /chatting for you/i,
  /dates?,? already booked/i,
  /you just show up/i,
  /we do (?:it all|the rest|all the work)/i,
  /we find you dates/i,
  /(?:we|NoSwipe) (?:(?:offer|offers|provide|provides|use|uses) )?(?:automate[sd]?|automated|automatic).{0,30}(?:swip|lik|messag)/i,
  /our (?:service offers )?(?:automated|automatic) (?:swip|lik|messag)/i,
  /(?:we|NoSwipe) (?:swipe|send messages|send replies|like profiles|confirm dates) (?:for you|on your behalf)/i,
  /(?:chat|message|reply|pretend) (?:in your voice|as you|for you)/i,
  /(?:we|NoSwipe) impersonat(?:e|es|ing) you/i
];

const forbiddenOutcomeClaims = [
  /we (?:will )?guarantee/i,
  /NoSwipe (?:will guarantee|guarantees)/i,
  /(?:matches?|replies?|dates?) (?:are )?guaranteed/i,
  /\bguaranteed[- ](?:matches?|replies?|dates?)\b(?![- ]claims)/i,
  /(?:get|land|secure|deliver) (?:you )?\d+[\d,]* (?:matches?|replies?|dates?)/i,
  /\b\d+(?:\.\d+)?% (?:more )?(?:matches?|replies?|dates?|success|conversion)/i,
  /\b(?:matches?|replies?|dates?|success|conversion).{0,24}\d+(?:\.\d+)?%/i,
  /\b\d+(?:\.\d+)?x (?:more )?(?:matches?|replies?|dates?)/i,
  /\b\d[\d,]*(?:[km]|\+)? (?:monthly )?search(?:es| volume)\b/i,
  /\bsearch volume (?:of |is |: )?\d/i,
  /\b(?:success|conversion|reply|match) rate (?:of |is |: )?\d/i,
  /\b(?:thousands|millions) of (?:monthly )?searches\b/i
];

const forbidden = [...forbiddenOperationPromises, ...forbiddenOutcomeClaims];
function copyViolations(copy) {
  const promises = copy.replace(/\b(?:no|avoid anyone selling) guaranteed[- ](?:matches?|replies?|dates?)\b/gi, "");
  return forbidden.filter((pattern) => pattern.test(promises));
}

for (const pattern of copyViolations(publicCopy)) {
  assert.fail(`public copy must not contain ${pattern}`);
}

// Mutation fixtures prove each policy category is actually enforced. Legitimate
// user actions, questions and explicit service boundaries must remain allowed.
const rejectedCopy = [
  "We swipe for you.",
  "NoSwipe operates your Tinder account.",
  "We can log in to your account.",
  "We manage your dating-app account.",
  "NoSwipe provides automated swiping.",
  "We use automatic likes.",
  "We send messages on your behalf.",
  "NoSwipe will chat as you.",
  "We impersonate you.",
  "NoSwipe guarantees matches.",
  "Dates are guaranteed.",
  "Get guaranteed matches.",
  "Get 20 matches this week.",
  "Our clients get 40% more matches.",
  "Expect 3x more replies.",
  "Our success rate is 95%.",
  "This keyword has 12,000 monthly searches.",
  "Search volume is 12000.",
  "Thousands of monthly searches make this topic valuable."
];
for (const copy of rejectedCopy) {
  assert.ok(copyViolations(copy).length > 0, `policy must reject: ${copy}`);
}
for (const copy of [
  "You swipe, send messages and confirm dates yourself.",
  "NoSwipe drafts replies. You review, edit and send them.",
  "We do not log in, swipe or send messages for you.",
  "NoSwipe does not provide automated swiping.",
  "Can NoSwipe operate my account? No.",
  "No reviewer can guarantee matches.",
  "No guaranteed matches, and avoid anyone selling guaranteed dates.",
  "Do not publish invented search-volume claims.",
  "We can draft 3 bio options for you."
]) {
  assert.deepEqual(copyViolations(copy), [], `policy must allow: ${copy}`);
}

assert.ok(contents["src/app/layout.tsx"].includes("You keep every account and send every message yourself."));
assert.ok(contents["src/app/opengraph-image.tsx"].includes("Screenshots in."));
assert.ok(contents["src/app/opengraph-image.tsx"].includes("You choose what to send."));
assert.ok(contents["src/components/landing-page.tsx"].includes("You keep your accounts, choose who to like and send every message yourself."));
assert.ok(contents["src/components/faq.tsx"].includes("We do not log in, swipe, like profiles, send messages or confirm dates for you."));

const guidePage = contents["src/app/guides/[slug]/page.tsx"];
assert.equal((guidePage.match(/<CtaLink\b/g) ?? []).length, 1, "each generated guide page must render exactly one reserve CTA");
assert.ok(guidePage.includes("utm_campaign=${guide.slug}&utm_content=guide-${guide.slug}-reserve"), "guide CTA attribution must include unique campaign and content values");
assert.ok(guidePage.includes("guide.sources.map"), "guide pages must render their cited primary sources");

console.log("public copy: compliant boundaries, outcome claims and guide structure passed");
