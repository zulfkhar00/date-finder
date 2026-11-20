// Drives the real NoSwipe UI through signup -> onboarding -> pay -> confirmation against the local
// mock stack (mock-services.mjs + `next dev` with preload.cjs). The embedded Stripe.js is replaced by
// a clearly labelled stub; the server-side Checkout Session, webhook signature check, finalize RPC and
// confirmation polling all run the app's real code.
//
//   PW_CORE=/path/to/playwright-core node scripts/e2e-mock/drive.mjs <outDir> [desktop|mobile] [email]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop", emailArg] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive.mjs <outDir> [desktop|mobile] [email]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const email = emailArg || `smoke-${kind}-${Date.now().toString(36)}@example.test`;
const shots = path.join(outDir, kind);
fs.mkdirSync(shots, { recursive: true });

const stub = `
window.Stripe = function (key) {
  window.__stubKey = key;
  return { createEmbeddedCheckoutPage: async function (o) {
    return {
      mount(el) {
        el.innerHTML = '<div style="font:16px system-ui;border:2px dashed #b45309;border-radius:12px;padding:20px;margin:16px;background:#fffbeb;color:#111">' +
          '<b style="color:#b45309">MOCK STRIPE EMBEDDED CHECKOUT - stub, not Stripe.js</b>' +
          '<p>noswipe - reserve early access</p><p style="font-size:28px;margin:8px 0">$1.00</p>' +
          '<p>Card 4242 4242 4242 4242 (simulated)</p>' +
          '<button id="stub-pay" style="padding:12px 20px;font-size:16px;border-radius:8px;background:#111;color:#fff">Pay $1.00 (simulated)</button></div>';
        el.querySelector('#stub-pay').onclick = async () => {
          const sid = o.clientSecret.split('_secret_')[0];
          const r = await fetch('${MOCK}/__stripe/pay?session=' + sid);
          window.__payResult = await r.json();
          o.onComplete();
        };
      }, destroy() {}
    };
  } };
};
window.Stripe.version = 3;`;

const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const context = await browser.newContext(kind === "mobile" ? { ...pw.devices["iPhone 14"] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const log = { email, kind, console: [], failed: [], externalAborted: [], steps: [] };
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on("pageerror", (e) => log.console.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on("response", (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
await context.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === "js.stripe.com") return route.fulfill({ contentType: "text/javascript", body: stub });
  if (["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:") return route.continue();
  log.externalAborted.push(u.hostname); return route.abort();
});

// Redaction without touching app state: mask the identity-bearing fields in the PNG itself.
async function shot(name) {
  const mask = [page.locator('input[name="email"]'), page.locator('input[name="code"]'), page.locator("strong")];
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: false, mask, maskColor: "#475569" });
  log.steps.push(`shot ${name}`);
}
const heading = (t) => page.getByRole("heading", { name: t }).waitFor({ timeout: 15000 }).catch(async (e) => {
  const body = (await page.locator("body").innerText()).slice(0, 400).replace(/\s+/g, " ");
  await page.screenshot({ path: path.join(shots, "FAILED.png") }).catch(() => {});
  console.error(`FAILED waiting for heading "${t}" at ${page.url()}\nvisible: ${body}\nconsole: ${JSON.stringify(log.console)}\nfailed: ${JSON.stringify(log.failed)}`);
  throw e;
});
const cont = (name = /^(Continue|Skip for now)$/) => page.getByRole("button", { name }).click();

await page.goto(`${APP}/`);
log.steps.push(`landing ${page.url()}`);
await page.locator('a[href*="/onboarding"]:visible').first().click();
await page.waitForURL("**/onboarding**");
await heading("A bit about you"); log.steps.push("on /onboarding basics");
await page.getByPlaceholder("First name").fill("Smoke");
await page.locator('input[type="date"]').fill("1996-04-12");
await page.locator(".app-chips").nth(0).locator("button").first().click();
await page.locator(".app-chips").nth(1).locator("button").first().click();
await shot("1-onboarding-basics");
await cont();
await heading("Where should we send your code?");
await shot("2-signup-email");
await page.locator('input[name="email"]').fill(email);
await page.getByRole("button", { name: "Email me a code" }).click();
await page.getByText("We emailed a code to").waitFor({ timeout: 15000 });
const mail = await (await fetch(`${MOCK}/__outbox`)).json();
const sent = [...mail.email].reverse().find((m) => m.to.includes(email));
const code = sent?.text.match(/\b(\d{6})\b/)?.[1];
if (!code) throw new Error("no sign-in code in mock outbox");
await shot("3-signup-code-sent");
await page.locator('input[name="code"]').fill(code);
await heading("Which apps?"); log.steps.push("signed in -> apps step");
await shot("4-onboarding-apps");
await page.locator(".app-choice").first().click();
await cont();
await heading("What do you do?"); await cont();
await heading("What's your type?");
await page.getByPlaceholder(/.*/).first().waitFor();
await page.locator('label:has-text("Where are you based") input').fill("San Francisco");
await cont();
await heading("Add your photos"); await shot("5-onboarding-photos"); await cont();
await heading("One last thing");
await page.getByRole("checkbox").check();
await shot("6-onboarding-consent");
await page.getByRole("button", { name: "Create my profiles" }).click();
await heading("Activate your profile");
await shot("7-pay-step");
await page.getByRole("button", { name: /Continue to checkout/ }).click();
await page.locator("#stub-pay").waitFor({ timeout: 15000 });
await shot("8-pay-embedded-checkout-MOCK");
await page.locator("#stub-pay").click();
await page.waitForURL("**/confirmation?session_id=cs_test_*", { timeout: 15000 });
log.steps.push(`confirmation url ${page.url().replace(/cs_test_\w+/, "cs_test_…")}`);
await page.getByText("your spot is reserved").waitFor({ timeout: 20000 });
await shot("9-confirmation");

const state = await (await fetch(`${MOCK}/__state`)).json();
const res = state.db.reservations.filter((r) => r.email === email);
const sess = state.stripeSessions.filter((s) => s.customer_email === email);
log.result = {
  reservations: res.map((r) => ({ status: r.status, queue_position: r.queue_position, sessionIsTest: r.stripe_checkout_session_id?.startsWith("cs_test_"), pi: r.stripe_payment_intent_id?.slice(0, 8) })),
  stripeSessions: sess.map((s) => ({ livemode: s.livemode, ui_mode: s.ui_mode, amount_total: s.amount_total, status: s.status, payment_status: s.payment_status })),
  stripeViolations: state.stripeViolations,
  funnelEvents: state.db.funnel_events.map((e) => ({ event: e.event, session: e.session_id?.slice(0, 9), dedupe: e.dedupe_key ? e.dedupe_key.split(":")[0] : null })),
  profile: state.db.profiles.map((p) => ({ internal: p.internal, step: p.onboarding_step, done: !!p.onboarding_done_at, name: p.first_name })),
  outbox: await (await fetch(`${MOCK}/__outbox`)).json()
};
log.result.outbox = { email: log.result.outbox.email.map((m) => m.subject), telegram: log.result.outbox.telegram.map((m) => m.text.split("\n")[0]) };
fs.writeFileSync(path.join(shots, "run.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
await browser.close();
