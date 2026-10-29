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

// Match account/profile interactions, not ordinary coaching conversations.
const agency = String.raw`(?:we|our team|NoSwipe|(?:our )?AI)`;
const positiveModal = String.raw`(?:(?:will|can) )?`;
const forbiddenOperationPromises = [
  new RegExp(String.raw`\b${agency} ${positiveModal}(?:swipes?|likes? profiles?|sends? (?:(?:your|my|the|every|each|all your) )?(?:messages?|repl(?:y|ies)|openers?))\b`, "i"),
  new RegExp(String.raw`\b${agency} ${positiveModal}(?:logs? (?:in(?: to)?|into)|access(?:es)?|operates?|runs?|controls?|manages?) (?:(?:your|my|the|users?['’]?) )?(?:(?:dating[- ]app|Tinder|Bumble|Hinge) )?accounts?\b`, "i"),
  new RegExp(String.raw`\b${agency} ${positiveModal}(?:chats?|messages?|repl(?:y|ies)|pretends?) (?:in your voice|as you|for you|with your matches|on your behalf)\b`, "i"),
  new RegExp(String.raw`\b${agency} ${positiveModal}(?:books?|confirms?) (?:(?:the|your|my) )?dates?\b`, "i"),
  /\byour (?:accounts?|profiles?|matches?|messages?) (?:are|is|will be) (?:managed|operated|controlled|sent) by (?:NoSwipe|our team|AI)\b/i,
  /swipes? done for you/i,
  /chatting for you/i,
  /dates?,? already booked/i,
  /you just show up/i,
  /we do (?:it all|the rest|all the work)/i,
  /we find you dates/i,
  new RegExp(String.raw`\b${agency} ${positiveModal}(?:(?:offers?|provides?|uses?) )?(?:automates?|automated|automatic).{0,30}(?:swip|lik|messag)`, "i"),
  /our (?:service offers )?(?:automated|automatic) (?:swip|lik|messag)/i,
  new RegExp(String.raw`\b${agency} ${positiveModal}impersonates? you\b`, "i")
];

// Capture a prohibition together with its action, so "never use fake photos"
// stays allowed without hiding a separate positive promise in the same copy.
function adviceRule(action) {
  return new RegExp(String.raw`\b(?:(?<prohibition>do not|does not|should not|must not|never|avoid|without|discourages?|against|recommends? (?:(?:that )?you )?(?:do )?not) )?(?:${action})`, "gi");
}
const forbiddenAdvice = [
  adviceRule(String.raw`(?:use|using|upload|uploading|generate|generating|create|creating|recommend|recommends|try) (?:\w+ ){0,4}(?:fake|synthetic|AI[- ]generated|materially altered) (?:dating[- ]app |dating |profile )?(?:photos?|images?)\b`),
  adviceRule(String.raw`(?:pressure|pressuring|guilt|guilting|coerce|coercing|manipulate|manipulating) (?:her|them|a match|your matches)\b`),
  adviceRule(String.raw`(?:ignore|ignoring|overcome|overcoming) (?:her|their|a|the) (?:no|refusal|boundaries|boundary)\b`),
  adviceRule(String.raw`(?:keep|continue) (?:messaging|pushing|asking)(?: her| them)? (?:until|after) (?:she|they) (?:agrees?|says? (?:yes|no)|declines?)\b`),
  adviceRule(String.raw`(?:use|using|try|enable|recommend|recommends) (?:\w+ ){0,6}(?:location spoofing|GPS spoofing|fake GPS)\b`),
  adviceRule(String.raw`(?:spoof|spoofing|fake|faking) (?:your|the|account) location\b`),
  adviceRule(String.raw`(?:(?:use|using|try) [^.;!?]{0,100}?(?:to )?)?(?:bypass|bypassing|evade|evading|circumvent|circumventing) (?:app |account |platform )?(?:bans?|restrictions|moderation|verification)\b`)
];

const forbiddenOutcomeClaims = [
  /we (?:will )?guarantee/i,
  /NoSwipe (?:(?:will|can) guarantee|guarantees)/i,
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
  const promises = copy
    .replace(/’/g, "'")
    .replace(/\bwe'll\b/gi, "we will")
    .replace(/\b(?:don't|doesn't|shouldn't|mustn't|won't)\b/gi, (word) => ({
      "don't": "do not", "doesn't": "does not", "shouldn't": "should not", "mustn't": "must not", "won't": "will not"
    })[word.toLowerCase()])
    // Join adjacent FAQ source literals so their answers are checked too.
    .replace(/["']\s*,\s*["']?(?:answer|a)["']?\s*:\s*["']/g, " ")
    .replace(new RegExp(String.raw`\b(?:can|will|does|do|should) (${agency}) ([^?"\n]*)\?`, "gi"), (question, subject, action, offset, text) => {
      const answer = text.slice(offset + question.length);
      // Only an explicit denial may suppress the question. Otherwise check its
      // action as a positive promise, including unanswered or ambiguous FAQs.
      if (/^\s*No[.!](?=\s|["']|$)/i.test(answer)) return "";
      return `${subject} can ${action}`;
    })
    .replace(/\b(?:no|avoid anyone selling) guaranteed[- ](?:matches?|replies?|dates?)\b/gi, "")
    .replace(/\s+/g, " ");
  const violations = forbidden.filter((pattern) => {
    const rule = new RegExp(String.raw`\b(?:(?<prohibition>do not let|never let|avoid letting|without letting) )?(?:${pattern.source})`, "gi");
    return [...promises.matchAll(rule)].some((match) => !match.groups?.prohibition);
  });
  return violations.concat(forbiddenAdvice.filter((pattern) =>
    [...promises.matchAll(pattern)].some((match) => !match.groups?.prohibition)
  ));
}

for (const pattern of copyViolations(publicCopy)) {
  assert.fail(`public copy must not contain ${pattern}`);
}

// Mutation fixtures prove each policy category is actually enforced. Legitimate
// user actions, questions and explicit service boundaries must remain allowed.
const rejectedCopy = [
  "We swipe for you.",
  "Our team swipes for you.",
  "We’ll send your messages.",
  "We'll send your messages.",
  "Your matches are managed by NoSwipe.",
  "AI sends replies on your behalf.",
  "NoSwipe operates your Tinder account.",
  "We can log in to your account.",
  "We manage your dating-app account.",
  "NoSwipe provides automated swiping.",
  "We can use automated swiping.",
  "NoSwipe will provide automated messaging.",
  "Our team can automate likes.",
  "Can NoSwipe run my account? Yes.",
  "Will NoSwipe operate my Tinder account? Absolutely.",
  "Can NoSwipe run my account? Maybe.",
  "Can NoSwipe run my account? No problem.",
  "Can NoSwipe run my account?",
  "Can we use automated swiping? Yes.",
  "Can NoSwipe guarantee matches? Yes.",
  "Can NoSwipe run my account? No. We run your account anyway.",
  '{ question: "Can NoSwipe run my account?", answer: "Yes." }',
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
  "Thousands of monthly searches make this topic valuable.",
  "Pressure her into a date.",
  "Ignore her no.",
  "Keep messaging until she agrees.",
  "Use fake dating photos.",
  "Upload synthetic profile images.",
  "We recommend using AI-generated dating photos.",
  "Use location spoofing to reach another city.",
  "Spoof your location.",
  "Use bots to bypass platform restrictions.",
  "Bypass account verification.",
  "Do not use fake photos, but AI sends replies on your behalf.",
  "Never pressure her. Use synthetic dating photos instead."
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
  "Can NoSwipe run my account? No.",
  "Can we use automated swiping? No.",
  "We cannot use automated swiping.",
  "We will not provide automated messaging.",
  "NoSwipe can send you draft options.",
  "Can NoSwipe send you draft options? Yes.",
  "Can we chat about your goals? Yes.",
  '{ question: "Can NoSwipe operate my account?", answer: "No. You keep control." }',
  '{ q: "Can NoSwipe operate my account?", a: "No. You keep control." }',
  "No reviewer can guarantee matches.",
  "No guaranteed matches, and avoid anyone selling guaranteed dates.",
  "Do not publish invented search-volume claims.",
  "We can draft 3 bio options for you.",
  "We chat about your goals.",
  "We can chat about your goals.",
  "Our team does not swipe for you.",
  "We won't send your messages.",
  "Your matches are not managed by NoSwipe.",
  "AI never sends replies on your behalf.",
  "Do not let AI send replies on your behalf.",
  "Do not pressure her into a date.",
  "Never ignore her no.",
  "Avoid pressuring your matches.",
  "Do not keep messaging until she agrees.",
  "Never use fake dating photos.",
  "Don't upload synthetic profile images.",
  "NoSwipe does not recommend using AI-generated dating photos.",
  "We recommend not using fake dating photos.",
  "We recommend you do not use fake dating photos.",
  "We discourage pressuring your matches.",
  "Do not use location spoofing.",
  "Avoid spoofing your location.",
  "Never bypass platform restrictions.",
  "Do not use location spoofing, new identities or automation to bypass restrictions."
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
