// Drives the real NoSwipe UI through signup -> onboarding (-> photos) -> consent, then watches the starter pack appear
// on Home. Runs against the local mock stack (mock-services.mjs + `next dev` with preload.cjs), with a STUB model:
// the real Anthropic API is never called. Screenshots are redacted (email/code masked).
//
//   PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome \
//     node scripts/e2e-mock/drive-pack.mjs <outDir> [desktop|mobile] [scenario]
//
// scenarios: happy (3 photos, city, Hinge + Tinder), flagged (the stub model flags photo 2 for review), nophotos, nocity, failure (model 429s, then recovers),
//            before (no pack: only used against a checkout that does not have the feature, to capture BEFORE)
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop", scenario = "happy"] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive-pack.mjs <outDir> [desktop|mobile] [scenario]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const email = `pack-${scenario}-${kind}-${Date.now().toString(36)}@example.test`;
const shots = path.join(outDir, `${scenario}-${kind}`);
fs.mkdirSync(shots, { recursive: true });
const photoCount = scenario === "happy" || scenario === "flagged" ? 3 : 0;
const city = scenario === "nocity" ? "" : "San Francisco";
const NAME = process.env.NAME || "Zhanserik";

// Solid-colour portrait PNGs with a simple "subject" shape, so ranked thumbnails are distinguishable.
function png(w, h, [r, g, b]) {
  const crc = (buf) => { let c, t = [], crc = ~0; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } for (const x of buf) crc = t[(crc ^ x) & 255] ^ (crc >>> 8); return (~crc) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 4), dy = (y - h * 0.38) / (h / 7), body = (x - w / 2) / (w / 3), by = (y - h * 0.72) / (h / 4.5);
      const inShape = dx * dx + dy * dy < 1 || body * body + by * by < 1;
      const o = y * (w * 3 + 1) + 1 + x * 3, shade = 1 - y / h * 0.35;
      raw[o] = inShape ? 250 : Math.round(r * shade); raw[o + 1] = inShape ? 226 : Math.round(g * shade); raw[o + 2] = inShape ? 205 : Math.round(b * shade);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PHOTOS = [[120, 160, 210], [90, 170, 120], [220, 150, 90]].map((c, i) => ({ name: `photo-${i + 1}.png`, mimeType: "image/png", buffer: png(300, 400, c) }));

const mockCall = (p) => fetch(`${MOCK}${p}`).then((r) => r.json());
const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const context = await browser.newContext(kind === "mobile" ? { ...pw.devices["iPhone 14"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const log = { email, kind, scenario, console: [], failed: [], externalAborted: [], steps: [], checks: {} };
page.on("console", (m) => { if (["error"].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => log.console.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on("response", (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
await context.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === "js.stripe.com") return route.fulfill({ contentType: "text/javascript", body: "window.Stripe=function(){return{createEmbeddedCheckoutPage:async()=>({mount(){},destroy(){}})}};" });
  if (["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
  log.externalAborted.push(u.hostname); return route.abort();
});
page.on("request", (r) => { const b = r.postData(); if (r.method() === "POST" && b && /tinder|hinge/.test(b) && process.env.DEBUG_POST) console.error("POST", b.slice(0, 300)); });
const mask = () => [page.locator('input[name="email"]'), page.locator('input[name="code"]'), page.locator(".app-shell-email")];
async function shot(name, full = false) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {}); // hide the dev-only overlay
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: full, mask: await mask(), maskColor: "#475569" });
  log.steps.push(`shot ${name}`);
}
const heading = (t) => page.getByRole("heading", { name: t }).waitFor({ timeout: 20000 }).catch(async (e) => {
  await page.screenshot({ path: path.join(shots, "FAILED.png") }).catch(() => {});
  console.error(`FAILED waiting for heading "${t}" at ${page.url()}\nconsole: ${JSON.stringify(log.console)}\nfailed: ${JSON.stringify(log.failed)}`);
  throw e;
});
const cont = (name = /^(Continue|Skip for now)$/) => page.getByRole("button", { name }).click();

await mockCall(`/__anthropic?mode=${scenario === "failure" ? "rate_limit" : scenario === "flagged" ? "flag" : "ok"}&delay=${scenario === "happy" || scenario === "nophotos" ? 6000 : 0}`);

await page.goto(`${APP}/`);
await page.locator('a[href*="/onboarding"]:visible').first().click();
await page.waitForURL("**/onboarding**");
await heading("A bit about you");
await page.getByPlaceholder("First name").fill(NAME);
await page.locator('input[type="date"]').fill("1996-04-12");
await page.locator(".app-chips").nth(0).locator("button").first().click();
await page.locator(".app-chips").nth(1).locator("button").first().click();
await cont();
await heading("Where should we send your code?");
await page.locator('input[name="email"]').fill(email);
// The first click can land before React has hydrated the form (dev server); retry until the code screen shows.
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: "Email me a code" }).click({ timeout: 3000 }).catch(() => {});
  if (await page.getByText("We emailed a code to").waitFor({ timeout: 5000 }).then(() => true, () => false)) break;
}
await page.getByText("We emailed a code to").waitFor({ timeout: 15000 }).catch(async (e) => {
  await page.screenshot({ path: path.join(shots, "FAILED.png") }).catch(() => {});
  console.error(`FAILED at email step: ${(await page.locator("body").innerText()).slice(0, 300).replace(/\s+/g, " ")}`);
  throw e;
});
const mail = await mockCall("/__outbox");
const code = [...mail.email].reverse().find((m) => m.to.includes(email))?.text.match(/\b(\d{6})\b/)?.[1];
if (!code) throw new Error("no sign-in code in mock outbox");
await page.locator('input[name="code"]').fill(code);
await heading("Which apps?");
await page.waitForTimeout(2500); // let the step settle after sign-in (dev server re-renders it once)
for (const n of [0, 1]) {
  const choice = page.locator(".app-choice").nth(n);
  if ((await choice.getAttribute("aria-pressed")) !== "true") { await choice.click(); await page.waitForTimeout(600); }
}
log.checks.appsPressed = await page.locator('.app-choice[aria-pressed="true"]').count();
await cont();
await heading("What do you do?");
await page.locator('label:has-text("Job") input, label:has-text("What do you do") input').first().fill("Nurse").catch(() => {});
await cont();
await heading("What's your type?");
if (city) await page.locator('label:has-text("Where are you based") input').fill(city);
await cont();
await heading("Add your photos");
await page.waitForTimeout(1000);
if (photoCount) {
  await page.locator('input[type="file"]').setInputFiles(PHOTOS.slice(0, photoCount));
  await page.waitForFunction((n) => document.querySelectorAll(".ob-photo img").length >= n, photoCount, { timeout: 20000 });
  await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 20000 }); // not "Skip for now": photos are in
}
await cont();
await heading("One last thing");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Create my profiles" }).click();
await heading("Activate your profile");
log.steps.push("onboarding complete (consent saved, pack runs after the response)");

await page.goto(`${APP}/home`);
await heading(/Hi /);
if (scenario === "before") {
  await shot("home-before", true);
  fs.writeFileSync(path.join(shots, "run.json"), JSON.stringify(log, null, 2));
  await browser.close();
  process.exit(0);
}
const waitReady = () => page.getByText("5 opening lines").waitFor({ timeout: 90000 });
if (scenario === "happy" || scenario === "nophotos") {
  await page.getByText("We’re writing your pack").waitFor({ timeout: 10000 });
  await shot("1-home-preparing", true);
  log.checks.preparingShown = true;
  await mockCall("/__anthropic?mode=ok&delay=0");
}
if (scenario === "failure") {
  await page.getByText("Your pack isn’t ready yet").waitFor({ timeout: 60000 });
  await shot("1-home-failed", true);
  log.checks.failedShown = true;
  await mockCall("/__anthropic?mode=ok&delay=0");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: /Starting/ }).waitFor({ timeout: 5000 }).then(() => { log.checks.buttonShowsLoading = true; }).catch(() => { log.checks.buttonShowsLoading = "too fast to catch"; });
}
await waitReady();
await shot("2-home-pack", true);
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
await page.screenshot({ path: path.join(shots, "3-home-pack-fold.png"), mask: await mask(), maskColor: "#475569" });

// Copy button: either the clipboard works, or the manual-select fallback appears. Never nothing.
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP }).catch(() => {});
const copy = page.locator(".sp-copy").first();
await copy.click();
await page.waitForFunction(() => /Copied/.test(document.querySelector(".sp-copy")?.textContent || "") || !!document.querySelector(".sp-manual"), null, { timeout: 5000 });
log.checks.copyFeedback = (await copy.innerText()).trim() || "manual";
// Overflow check at this width: nothing may be wider than the viewport.
log.checks.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

const state = await mockCall("/__state");
const mine = state.db.starter_packs.at(-1)?.user_id; // the newest user is this run's
const packs = state.db.starter_packs.filter((r) => r.user_id === mine), runs = state.db.starter_pack_runs.filter((r) => r.user_id === mine);
log.checks.photosUploaded = state.db.profile_photos.filter((r) => r.user_id === mine).length;
log.checks.appAccounts = state.db.app_accounts.filter((r) => r.user_id === mine).map((r) => r.app);
log.checks.packRows = packs.length;
log.checks.packStatus = packs[0]?.status;
log.checks.runs = runs.map((r) => ({ kind: r.kind, tokens: r.tokens }));
log.checks.modelCallsSoFar = { total: state.anthropic.calls, vision: state.anthropic.vision };
log.checks.photosSection = packs[0]?.content?.photos?.kind;
log.checks.appsInPack = packs[0]?.content?.profiles?.map((p) => p.app);
log.checks.emails = (await mockCall("/__outbox")).email.map((m) => m.subject);

// Regenerate: 3 per day, the 4th is refused.
if (scenario === "happy") {
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole("button", { name: /Write it again/ });
    await btn.click();
    await page.waitForFunction(() => /\d+ left today|No refreshes left/.test(document.querySelector(".sp-regen")?.textContent || ""), null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.reload();
    await waitReady();
  }
  log.checks.regenButtonAfter3 = await page.getByRole("button", { name: /Write it again/ }).isDisabled();
  log.checks.regenText = (await page.locator(".sp-regen").innerText()).replace(/\s+/g, " ");
  await shot("4-home-pack-bottom", false);
  const after = await mockCall("/__state");
  log.checks.regenRuns = after.db.starter_pack_runs.filter((r) => r.user_id === mine && r.kind === "regenerate").length;
  log.checks.packRowsForUser = after.db.starter_packs.filter((r) => r.user_id === mine).length;
  // Cron route: wrong secret refused, right secret sweeps (nothing left to do for this user).
  const bad = await fetch(`${APP}/api/cron/starter-packs`, { headers: { authorization: "Bearer nope" } });
  const good = await fetch(`${APP}/api/cron/starter-packs`, { headers: { authorization: "Bearer mock-cron-secret" } });
  log.checks.cron = { wrongSecret: bad.status, rightSecret: good.status, body: await good.json() };
}

log.checks.pageText = (await page.locator("body").innerText()).includes("Use this on Hinge");
fs.writeFileSync(path.join(shots, "run.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
await browser.close();
