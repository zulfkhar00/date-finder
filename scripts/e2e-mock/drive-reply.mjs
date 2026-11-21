// Drives the Reply helper against the local mock stack (mock-services.mjs + `next dev` with preload.cjs) with a STUB model:
// the real Anthropic API is never called. SYNTHETIC data only (example.test address, invented name, drawn "chat" images).
//
//   ADMIN_EMAILS=admin@example.test (set when starting `next dev`, for the admin usage shot)
//   PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome \
//     node scripts/e2e-mock/drive-reply.mjs <outDir> [desktop|mobile] [prefix]
//
// prefix "before" only captures the screens that exist without the feature (Chats empty state, Home), for BEFORE shots.
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop", prefix = "after"] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive-reply.mjs <outDir> [desktop|mobile] [after|before]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const ADMIN = "admin@example.test";
const KEY = { apikey: "mock-service-key", Authorization: "Bearer mock-service-key", "Content-Type": "application/json", Prefer: "return=representation" };
fs.mkdirSync(outDir, { recursive: true });
const before = prefix === "before";

const rest = (table, body) => fetch(`${MOCK}/rest/v1/${table}`, { method: "POST", headers: KEY, body: JSON.stringify(body) }).then((r) => r.json());
const mock = (p) => fetch(`${MOCK}${p}`).then((r) => r.json());
const mkUser = (email) => fetch(`${MOCK}/auth/v1/admin/users`, { method: "POST", headers: KEY, body: JSON.stringify({ email }) }).then((r) => r.json());
const stamp = Date.now().toString(36);
const ago = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

// A drawn chat screenshot: grey bubbles on the left, coral on the right. No real people, no text.
function png(w, h, seed) {
  const crc = (buf) => { let c, t = [], crc = ~0; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } for (const x of buf) crc = t[(crc ^ x) & 255] ^ (crc >>> 8); return (~crc) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const bubbles = [];
  for (let i = 0, y = Math.round(h * 0.08); y < h * 0.92; i++) { const mine = (i + seed) % 3 === 1; const bw = Math.round(w * (0.35 + ((i * 37 + seed * 11) % 30) / 100)); const bh = Math.round(h * (0.05 + ((i * 17 + seed) % 4) / 100)); bubbles.push({ x: mine ? w - bw - Math.round(w * 0.06) : Math.round(w * 0.06), y, bw, bh, mine }); y += bh + Math.round(h * 0.03); }
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const b = bubbles.find((q) => x >= q.x && x < q.x + q.bw && y >= q.y && y < q.y + q.bh);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const [r, g, bl] = b ? (b.mine ? [255, 90, 71] : [226, 222, 235]) : [250, 247, 255];
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = bl;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const SHOTS = [1, 2, 3].map((n) => ({ name: `chat-${n}.png`, mimeType: "image/png", buffer: png(390, 844, n) }));

// ---- seed: one onboarded user with a ready starter pack ----
await mkUser(ADMIN);
const email = `reply-${kind}-${stamp}@example.test`;
const user = await mkUser(email);
await rest("profiles", { user_id: user.id, first_name: "Zhanserik", city: "Almaty", job: "Nurse", voice: "playful", interests: ["climbing", "ramen"], gender: "man", interested_in: ["women"], onboarding_done_at: ago(48), onboarding_step: 9 });
await rest("app_accounts", { user_id: user.id, app: "hinge", status: "setting_up" });
const pack = {
  v: 1,
  profiles: [{ app: "hinge", bio: "Night-shift nurse who climbs on weekends.", prompts: [{ prompt: "Typical Sunday", answer: "Bouldering until my forearms quit, then ramen." }, { prompt: "I geek out on", answer: "Anything that makes a long shift go faster." }, { prompt: "The way to win me over is", answer: "Tell me the best thing you ate this week." }] }],
  photos: { kind: "checklist", items: ["A clear solo shot in daylight, face fully visible."] },
  openers: ["What is the best thing you ate this week?", "Settle this for me: ramen at midnight, yes or no?", "Which of your photos has the best story?", "Two truths and a lie about your weekend.", "You look like someone with a strong coffee opinion."].map((line) => ({ line, why: "Easy to answer in one line." })),
  replies: [{ situation: "They answer with one word", template: "Fair. Give me one thing that made today better and I will match it." }, { situation: "The chat is going well", template: "I am enjoying this. Coffee this week, somewhere easy to leave?" }, { situation: "They ask what you want", template: "Something real, without rushing it. You?" }],
  datePlan: { headline: "Coffee and a short walk", venues: [{ type: "a quiet coffee place with outdoor seating", why: "Easy to talk." }, { type: "a short walk in a busy park", why: "No pressure to stay." }], when: "Saturday, 11am", budget: "$10-20 each", backup: "Indoor bookshop cafe if it rains.", tip: "Meet in public and tell a friend where you are." }
};
await rest("starter_packs", { user_id: user.id, version: 1, status: "ready", content: pack, model: "claude-sonnet-5-5", generated_at: ago(40) });
await mock("/__anthropic?mode=ok&delay=0");

const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const mobile = kind === "mobile";
const newContext = () => browser.newContext(mobile ? { ...pw.devices["iPhone 14"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const log = { email, kind, console: [], failed: [], externalAborted: [], checks: {} };
async function open(context) {
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") log.console.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => log.console.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    log.externalAborted.push(u.hostname); return route.abort();
  });
  return page;
}
const mask = (page) => [page.locator('input[name="email"]'), page.locator('input[name="code"]'), page.locator(".app-shell-email")];
async function shot(page, name, full = true) {
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: path.join(outDir, `${prefix}-${name}-${kind}.png`), fullPage: full, mask: mask(page), maskColor: "#475569" });
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function signIn(page, who) {
  await page.goto(`${APP}/login`);
  await page.locator('input[name="email"]').fill(who);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.locator('input[name="code"]').waitFor({ timeout: 15000 });
  const m = await mock("/__outbox");
  const c = [...m.email].reverse().find((x) => x.to.includes(who))?.text.match(/\b(\d{6,10})\b/)?.[1];
  await page.locator('input[name="code"]').fill(c);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home", { timeout: 20000 });
}

const ctx = await newContext();
const page = await open(ctx);
await signIn(page, email);
await page.getByRole("heading", { name: "Your starter pack" }).waitFor({ timeout: 20000 });
await shot(page, "01-home-starter-pack");
await page.goto(`${APP}/chats`);
await page.getByRole("heading", { name: "Chats" }).waitFor();
await shot(page, "02-chats-empty", false);
log.checks.chatsOverflow = await overflow(page);
if (before) { log.checks.ctaPresent = await page.getByTestId("reply-helper-cta").count(); console.log(JSON.stringify(log, null, 2)); await browser.close(); process.exit(0); }

log.checks.ctaPresent = await page.getByTestId("reply-helper-cta").isVisible();
await page.goto(`${APP}/home`);
log.checks.homeLink = await page.getByTestId("pack-reply-helper-link").isVisible();
await page.getByTestId("pack-reply-helper-link").click();
await page.waitForURL("**/chats/reply");
await page.getByRole("heading", { name: "Reply helper" }).waitFor();
await shot(page, "03-reply-empty", false);
log.checks.submitDisabledWhenEmpty = await page.getByTestId("rh-submit").isDisabled();

// Choose screenshots (the same file twice counts once; a fourth+ is capped)
const input = page.getByTestId("rh-file");
await input.setInputFiles([SHOTS[0], SHOTS[1], SHOTS[0]]);
await page.getByRole("list", { name: "Chosen screenshots" }).waitFor();
log.checks.thumbsAfterDuplicate = await page.locator(".rh-thumbs li").count();
await shot(page, "04-reply-chosen", false);
log.checks.formOverflow = await overflow(page);

// Submit twice quickly: one model call. Slow the stub so the loading state is visible.
await mock("/__anthropic?mode=ok&delay=2500");
const before1 = (await mock("/__state")).anthropic.reply;
const submit = page.getByTestId("rh-submit");
await submit.click();
await page.getByTestId("rh-submit").click({ timeout: 800, force: true }).catch(() => undefined); // double tap while in flight
log.checks.disabledInFlight = await page.getByTestId("rh-submit").isDisabled().catch(() => null);
log.checks.loadingLabel = await page.getByTestId("rh-submit").innerText().catch(() => null);
await shot(page, "05-reply-loading", false);
await page.getByTestId("rh-result").waitFor({ timeout: 20000 });
log.checks.modelCallsForDoubleSubmit = (await mock("/__state")).anthropic.reply - before1;
log.checks.imagesSentToModel = (await mock("/__state")).anthropic.replyImages;
log.checks.replies = await page.getByTestId("rh-reply").count();
log.checks.dateMoveShown = await page.getByTestId("rh-date").isVisible();
log.checks.urlHasThread = /\?t=/.test(page.url());
await mock("/__anthropic?mode=ok&delay=0");
await shot(page, "06-reply-drafts");
log.checks.resultOverflow = await overflow(page);

// Copy, then a tweak chip
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
await page.getByTestId("rh-reply").first().getByRole("button", { name: /Copy/ }).click();
await page.waitForTimeout(600);
log.checks.copiedLabel = await page.getByTestId("rh-reply").first().getByText(/Copied|Select this text/).first().isVisible().catch(() => false);
await page.getByRole("button", { name: "Shorter" }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="rh-reply"] p')?.textContent?.includes("Sacrament. Your turn."), null, { timeout: 15000 });
log.checks.shorterApplied = true;
await shot(page, "07-reply-shorter");
await page.getByRole("button", { name: "Write them again" }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="rh-reply"] p')?.textContent?.includes("ranking"), null, { timeout: 15000 });
log.checks.regenerateApplied = true;

// Pasted text in another language
await page.getByRole("button", { name: "Start another chat" }).click();
await page.getByRole("tab", { name: "Paste text" }).click();
await page.getByTestId("rh-text").fill("Ella: jaja ¿qué haces?\nYo: nada, cenando ramen");
await page.getByTestId("rh-submit").click();
await page.getByTestId("rh-result").waitFor({ timeout: 20000 });
log.checks.spanishRead = await page.getByTestId("rh-read").innerText();
await shot(page, "08-reply-spanish");

// A blurry or unrelated screenshot: asks for a clearer one
await mock("/__anthropic?mode=unreadable&delay=0");
await page.getByRole("button", { name: "Start another chat" }).click();
await page.getByTestId("rh-file").setInputFiles([SHOTS[2]]);
await page.getByTestId("rh-submit").click();
await page.getByTestId("rh-error").waitFor({ timeout: 20000 });
log.checks.unreadableMessage = await page.getByTestId("rh-error").innerText();
await shot(page, "09-reply-unreadable", false);

// The model rate-limits: three tries, then a friendly error (nothing saved, the screenshot choice is kept so the user can retry)
await mock("/__anthropic?mode=rate_limit&delay=0");
await page.getByTestId("rh-submit").click();
await page.getByTestId("rh-error").filter({ hasText: /couldn't finish/ }).waitFor({ timeout: 30000 });
log.checks.rateLimitMessage = await page.getByTestId("rh-error").innerText();
await shot(page, "10-reply-error", false);
await mock("/__anthropic?mode=ok&delay=0");

// Saved threads survive a reload and are the user's own
await page.goto(`${APP}/chats/reply`);
log.checks.savedThreads = await page.locator(".rh-saved-row").count();
await shot(page, "11-reply-saved");

const state = await mock("/__state");
log.checks.threadsInDb = state.db.reply_threads.length;
log.checks.noImageBytesInDb = !JSON.stringify(state.db.reply_threads).includes("iVBOR") && !JSON.stringify(state.db.reply_threads).includes("base64");
log.checks.runsLedger = state.db.reply_helper_runs.map((r) => ({ kind: r.kind, outcome: r.outcome, finished: !!r.finished_at, tokens: r.tokens }));
log.checks.funnel = state.db.funnel_events.filter((e) => /^reply_/.test(e.event)).map((e) => e.event);
log.checks.funnelHasNoContent = state.db.funnel_events.filter((e) => /^reply_/.test(e.event)).every((e) => !e.user_id && Object.values(e).every((v) => typeof v !== "string" || !/ramen|Sacrament/.test(v)));

// Delete one thread
await page.locator(".rh-del").first().click();
await page.waitForFunction((n) => document.querySelectorAll(".rh-saved-row").length === n, log.checks.savedThreads - 1, null, { timeout: 8000 });
log.checks.deleteWorks = true;
await ctx.close();

// Admin per-user view: counts only
{
  const actx = await newContext(); const admin = await open(actx);
  await admin.goto(`${APP}/admin/login`);
  for (let i = 0; i < 6; i++) { await admin.locator('input[name="email"]').fill(ADMIN); await admin.getByRole("button", { name: /code|Continue|Sign in/i }).first().click(); if (await admin.locator('input[name="code"]').waitFor({ timeout: 5000 }).then(() => true, () => false)) break; }
  const mail = await mock("/__outbox");
  const code = [...mail.email].reverse().find((m) => m.to.includes(ADMIN))?.text.match(/\b(\d{6,10})\b/)?.[1];
  await admin.locator('input[name="code"]').fill(code);
  await admin.getByRole("button", { name: /Sign in|Verify|Continue/i }).first().click();
  await admin.waitForURL("**/admin**", { timeout: 20000 });
  await admin.goto(`${APP}/admin/clients/${user.id}`);
  await admin.getByTestId("reply-usage").waitFor({ timeout: 20000 });
  log.checks.adminUsage = await admin.getByTestId("reply-usage").innerText();
  log.checks.adminShowsContent = /Sacrament|Counterpoint|midnight food crime|tonkotsu|ranking/.test(await admin.locator("main").innerText().catch(() => ""));
  await shot(admin, "12-admin-usage", false);
  await actx.close();
}

fs.writeFileSync(path.join(outDir, `${prefix}-log-${kind}.json`), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
await browser.close();
