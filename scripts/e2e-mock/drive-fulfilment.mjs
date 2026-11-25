// Drives the fulfilment queue, the per-app status workflow and the client Home against the local mock stack. SYNTHETIC people only
// (first names, mail.fixture.dev addresses that are masked in every screenshot); the real Supabase is never reached.
//
//   ADMIN_EMAILS=admin@example.test (set when starting `next dev`), mock-services.mjs running
//   PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome node scripts/e2e-mock/drive-fulfilment.mjs <outDir> [desktop|mobile]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop"] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive-fulfilment.mjs <outDir> [desktop|mobile]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const ADMIN = "admin@example.test";
const shots = path.join(outDir, kind);
fs.mkdirSync(shots, { recursive: true });

const H = 3_600_000;
const ago = (h) => new Date(Date.now() - h * H).toISOString();
const KEY = { apikey: "mock-service-key", Authorization: "Bearer mock-service-key", "Content-Type": "application/json" };
const rest = (method, p, body, extra = {}) => fetch(`${MOCK}/rest/v1/${p}`, { method, headers: { ...KEY, ...extra }, body: body ? JSON.stringify(body) : undefined });
const mock = (p) => fetch(`${MOCK}${p}`).then((r) => r.json());
const mkUser = async (email) => (await (await fetch(`${MOCK}/auth/v1/admin/users`, { method: "POST", headers: KEY, body: JSON.stringify({ email }) })).json()).id;

const tag = Date.now().toString(36);
async function person({ name, done, paid, paidHoursAgo, country, apps = [], hold = null, pendingCountry = null }) {
  const email = `${name.toLowerCase()}.${tag}@mail.fixture.dev`;
  const id = await mkUser(email);
  await rest("POST", "profiles", { user_id: id, first_name: name, internal: false, onboarding_step: 7, onboarding_done_at: ago(done), created_at: ago(done + 2), city: "Austin", report_hold: hold });
  if (paid) await rest("POST", "reservations", { email, city: "Austin", dating_preference: "all_genders", relationship_goal: "meaningful", date_frequency: "twice_monthly", age_confirmed_at: ago(done), terms_accepted_at: ago(done), status: "paid", paid_at: ago(paidHoursAgo ?? done), stripe_checkout_session_id: `cs_live_${name}${tag}`, stripe_payment_intent_id: `pi_${name}${tag}`, queue_position: Math.floor(Math.random() * 1e6), billing_country: country });
  if (pendingCountry) {
    await rest("POST", "reservations", { email, city: "Berlin", dating_preference: "all_genders", relationship_goal: "meaningful", date_frequency: "twice_monthly", age_confirmed_at: ago(done), terms_accepted_at: ago(done), status: "pending", stripe_checkout_session_id: `cs_live_${name}${tag}` });
    await rest("POST", "funnel_events", { event: "checkout_created", session_id: `s-${name}${tag}`, dedupe_key: `checkout_created:cs_live_${name}${tag}`, country: pendingCountry });
  }
  for (const [app, status, changedHoursAgo, reason] of apps) await rest("POST", "app_accounts", { user_id: id, app, status, user_paused: false, client_action_reason: reason ?? null, status_changed_at: changedHoursAgo == null ? null : ago(changedHoursAgo) });
  return { id, email, name };
}

// Admin session (same flow as drive-admin-flags.mjs).
await fetch(`${MOCK}/auth/v1/admin/users`, { method: "POST", headers: KEY, body: JSON.stringify({ email: ADMIN }) });
const people = {
  ava: await person({ name: "Ava", done: 56, paid: true, paidHoursAgo: 52, country: "US", apps: [["hinge", "setting_up"], ["tinder", "setting_up"]] }),
  ben: await person({ name: "Ben", done: 90, paid: true, paidHoursAgo: 80, country: "GB", apps: [["hinge", "setting_up"]] }),
  cleo: await person({ name: "Cleo", done: 6, paid: true, paidHoursAgo: 5, country: "CA", apps: [["bumble", "setting_up"]] }),
  dan: await person({ name: "Dan", done: 60, paid: true, paidHoursAgo: 58, country: "AU", apps: [] }),
  eli: await person({ name: "Eli", done: 20, paid: false, apps: [["bumble", "setting_up"]] }),
  fay: await person({ name: "Fay", done: 150, paid: false, pendingCountry: "DE", apps: [["tinder", "setting_up"]] }),
  gus: await person({ name: "Gus", done: 95, paid: true, paidHoursAgo: 90, country: "NZ", apps: [["hinge", "needs_client_action", 20, "Add 2 more photos"]] }),
  hana: await person({ name: "Hana", done: 200, paid: true, paidHoursAgo: 190, country: "US", apps: [["hinge", "active", 150]] }),
  ivy: await person({ name: "Ivy", done: 100, paid: true, paidHoursAgo: 99, country: "US", hold: "paused", apps: [["hinge", "paused", 3]] })
};

const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const ctxOpts = kind === "mobile" ? { ...pw.devices["iPhone 14"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1440, height: 900 } };
const log = { kind, console: [], checks: {} };
const route = (context) => context.route("**/*", (r) => {
  const u = new URL(r.request().url());
  return ["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:" ? r.continue() : r.abort();
});
async function signIn(page, email, loginPath, button, landing) {
  await page.goto(`${APP}${loginPath}`);
  await page.locator('input[name="email"]').fill(email);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: button }).click({ timeout: 3000 }).catch(() => {});
    if (await page.locator('input[name="code"]').waitFor({ timeout: 5000 }).then(() => true, () => false)) break;
  }
  let code;
  // /login answers before the mail goes out, so wait for it.
  for (let i = 0; i < 40 && !code; i++) {
    const mail = await mock("/__outbox");
    code = [...mail.email].reverse().find((m) => m.to.includes(email))?.text.match(/\b(\d{6,10})\b/)?.[1];
    if (!code) await new Promise((r) => setTimeout(r, 250));
  }
  if (!code) throw new Error("no code in the mock outbox");
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing, { timeout: 25000 });
}
const maskFor = (page) => [page.locator(".app-shell-email"), page.locator(".fx-email")];
async function shot(page, name, full = true) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: full, mask: await maskFor(page), maskColor: "#475569" });
}

// ---------- admin ----------
const adminCtx = await browser.newContext(ctxOpts);
await route(adminCtx);
const admin = await adminCtx.newPage();
admin.on("console", (m) => { if (m.type() === "error") log.console.push(m.text().slice(0, 200)); });
await signIn(admin, ADMIN, "/admin/login", /Email me a sign-in link/, "**/admin");

await admin.goto(`${APP}/admin/fulfilment`);
await admin.getByRole("heading", { name: "Fulfilment" }).waitFor();
await admin.getByTestId("fulfilment-table").waitFor();
const order = await admin.locator("tbody tr td:nth-child(2) a").allInnerTexts();
log.checks.order = order;
log.checks.paidWaiting = await admin.getByTestId("paid-waiting").innerText();
log.checks.over72 = await admin.getByTestId("over-72").innerText();
log.checks.slaBadges = await admin.locator("[data-sla]").evaluateAll((els) => els.map((e) => `${e.textContent}:${e.getAttribute("data-sla")}`));
log.checks.overflowX = await admin.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await shot(admin, "1-admin-fulfilment-queue");

await admin.goto(`${APP}/admin/fulfilment?paid=unpaid&country=unsupported`);
await admin.getByTestId("fulfilment-table").waitFor();
log.checks.unpaidUnsupported = await admin.locator("tbody tr td:nth-child(2) a").allInnerTexts();
await shot(admin, "2-admin-fulfilment-filtered");

await admin.goto(`${APP}/admin/clients/${people.ava.id}`);
const flow = admin.getByTestId("app-workflow");
await flow.waitFor();
const hingeBlock = flow.locator("form").first();
await hingeBlock.locator('select[name="status"]').selectOption("needs_client_action");
await hingeBlock.locator('input[name="reason"]').fill("Log in on a fresh browser profile");
await hingeBlock.locator('input[name="note"]').fill("Hinge flagged a new device. Asked her to retry.");
await hingeBlock.getByRole("button", { name: "Save status" }).click();
await admin.getByText("Status saved").first().waitFor({ timeout: 15000 });
await admin.reload();
await admin.getByTestId("fulfilment-log").waitFor();
log.checks.logRows = await admin.getByTestId("fulfilment-log").locator("li").allInnerTexts();
log.checks.overflowXClient = await admin.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await shot(admin, "3-admin-client-workflow");

// ---------- client Home, one screenshot per state ----------
const zoe = await person({ name: "Zoe", done: 3, paid: true, paidHoursAgo: 2, country: "US", apps: [["hinge", "setting_up"], ["tinder", "setting_up"]] });
const clientCtx = await browser.newContext(ctxOpts);
await route(clientCtx);
const page = await clientCtx.newPage();
page.on("console", (m) => { if (m.type() === "error") log.console.push(m.text().slice(0, 200)); });
await signIn(page, zoe.email, "/login", /Email me a code/, "**/home");
const set = (app, status, reason) => rest("PATCH", `app_accounts?user_id=eq.${zoe.id}&app=eq.${app}`, { status, client_action_reason: reason ?? null, status_changed_at: new Date().toISOString() });
const rowText = async () => (await page.locator("[data-testid^=app-status-]").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
async function home(name) {
  await page.goto(`${APP}/home`);
  await page.locator("[data-testid^=app-status-]").first().waitFor({ timeout: 20000 });
  log.checks[name] = await rowText();
  await shot(page, name);
}
await home("h1-setting-up-paid");
await rest("PATCH", `profiles?user_id=eq.${zoe.id}`, { onboarding_done_at: ago(120) });
await rest("PATCH", `reservations?email=eq.${zoe.email}`, { paid_at: ago(100) });
await home("h2-setting-up-late");
await rest("PATCH", `profiles?user_id=eq.${zoe.id}`, { onboarding_done_at: ago(3) });
await rest("PATCH", `reservations?email=eq.${zoe.email}`, { paid_at: ago(2) });
await set("hinge", "needs_client_action", "Add 2 more photos");
await set("tinder", "active");
await home("h3-needs-you-and-active");
await set("hinge", "paused");
await set("tinder", "closed");
await home("h4-paused-and-closed");
const reportId = crypto.randomUUID();
await rest("POST", "reports", { id: reportId, ref: `NS-FX${tag.toUpperCase().slice(-2)}-HOLD`, status: "actioned", category: "scam_fraud", urgent: false, in_danger: false, subject_kind: "profile", description: "synthetic", matched_user_id: zoe.id, created_at: ago(5), updated_at: ago(4), resolved_at: ago(4), decided_by: ADMIN });
await rest("PATCH", `profiles?user_id=eq.${zoe.id}`, { report_hold: "paused", report_hold_report_id: reportId, report_hold_at: ago(4) });
await set("hinge", "needs_client_action", "Add 2 more photos");
await home("h5-report-hold-overrides");
await rest("PATCH", `profiles?user_id=eq.${zoe.id}`, { report_hold: null, report_hold_report_id: null, report_hold_at: null });
await set("hinge", "setting_up");
await set("tinder", "setting_up");
await rest("DELETE", `reservations?email=eq.${zoe.email}`);
await home("h6-unpaid-activate-card");
log.checks.resumeCardTitle = await page.locator("#resume-title").innerText().catch(() => null);
log.checks.homeOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
fs.writeFileSync(path.join(shots, `fulfilment-${kind}.json`), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log.checks, null, 2), log.console.length ? `\nconsole errors: ${log.console.join(" | ")}` : "");
await browser.close();
