import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "src/app/layout.tsx",
  "src/app/opengraph-image.tsx",
  "src/components/landing-page.tsx",
  "src/components/hero-phone.tsx",
  "src/components/match-cards.tsx",
  "src/components/your-week.tsx",
  "src/components/faq.tsx"
];

const contents = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])));
const publicCopy = Object.values(contents).join("\n");
const forbidden = [
  /we (?:swipe|chat|book)(?:\b|\.)/i,
  /NoSwipe runs your/i,
  /swipes? done for you/i,
  /chatting for you/i,
  /dates?,? already booked/i,
  /you just show up/i,
  /we do (?:it all|the rest|all the work)/i,
  /we find you dates/i,
  /books? (?:the|your) dates?/i
];

for (const pattern of forbidden) {
  assert.equal(pattern.test(publicCopy), false, `public copy must not contain ${pattern}`);
}

assert.ok(contents["src/app/layout.tsx"].includes("You keep every account and send every message yourself."));
assert.ok(contents["src/app/opengraph-image.tsx"].includes("Screenshots in."));
assert.ok(contents["src/app/opengraph-image.tsx"].includes("You choose what to send."));
assert.ok(contents["src/components/landing-page.tsx"].includes("You keep your accounts, choose who to like and send every message yourself."));
assert.ok(contents["src/components/faq.tsx"].includes("We do not log in, swipe, like profiles, send messages or confirm dates for you."));

console.log("public copy: compliant account and messaging boundaries passed");
