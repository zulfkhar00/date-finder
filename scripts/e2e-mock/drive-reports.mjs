// Drives the takedown process against the local mock stack: the public /report form (empty, emergency guidance, validation,
// confirmation), the admin queue (urgent, overdue, grouped, filters), a report with its actions and NCMEC panel, an appeal
// with the same-admin warning, and the in-app appeal notice for a paused and a closed account. SYNTHETIC data only
// (example.test addresses, invented names); the real Supabase is never reached.
//
//   ADMIN_EMAILS=admin@example.test (set when starting `next dev`)
//   PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome node scripts/e2e-mock/drive-reports.mjs <outDir> [desktop|mobile]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop"] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive-reports.mjs <outDir> [desktop|mobile]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const ADMIN = "admin@example.test";
const KEY = { apikey: "mock-service-key", Authorization: "Bearer mock-service-key", "Content-Type": "application/json", Prefer: "return=representation" };
fs.mkdirSync(outDir, { recursive: true });

const rest = (table, body) => fetch(`${MOCK}/rest/v1/${table}`, { method: "POST", headers: KEY, body: JSON.stringify(body) }).then((r) => r.json());
const mock = (p) => fetch(`${MOCK}${p}`).then((r) => r.json());
const mkUser = (email) => fetch(`${MOCK}/auth/v1/admin/users`, { method: "POST", headers: KEY, body: JSON.stringify({ email }) }).then((r) => r.json());
const ago = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const stamp = Date.now().toString(36);

// ---- seed ----
await mkUser(ADMIN);
const jake = await mkUser(`jake-${stamp}@example.test`);
const sam = await mkUser(`sam-${stamp}@example.test`);
for (const [u, name, hold, holdAt] of [[jake, "Jake", null, null], [sam, "Sam", "closed", ago(30)]]) {
  await rest("profiles", { user_id: u.id, first_name: name, onboarding_done_at: ago(500), onboarding_step: 9, report_hold: hold, report_hold_at: holdAt, report_hold_report_id: null });
  await rest("app_accounts", { user_id: u.id, app: "tinder", status: hold ? "paused" : "live" });
}
const R = (o) => ({ status: "new", urgent: false, in_danger: false, subject_kind: "profile", dating_app: "tinder", profile_ref: null, group_key: null, reporter_email: null, attachment_path: null, ...o, updated_at: o.created_at });
const ref = (n) => `NS-${n}-${stamp.toUpperCase().replace(/[^A-Z0-9]/g, "A").padEnd(4, "A").slice(0, 4)}`;
const seeded = await rest("reports", [
  R({ ref: ref("URG1"), category: "minor_safety", urgent: true, created_at: ago(6), profile_ref: "Alex", group_key: "tinder:alex", description: "The profile says 16 in the bio and the photos look like a school uniform.", reporter_email: "reporter1@example.test" }),
  R({ ref: ref("URG2"), category: "threats", urgent: true, in_danger: true, dating_app: "hinge", created_at: ago(1), profile_ref: "Chris", group_key: "hinge:chris", description: "He said he knows where I live and will come over tonight." }),
  R({ ref: ref("OVD1"), category: "scam_fraud", created_at: ago(30), profile_ref: "Jake", group_key: "tinder:jake", description: "Asked for money for a plane ticket on the second day.", matched_user_id: jake.id }),
  R({ ref: ref("OVD2"), category: "scam_fraud", created_at: ago(20), profile_ref: "https://tinder.com/@Jake", group_key: "tinder:jake", description: "Same person as the other report. Sent a crypto link." }),
  R({ ref: ref("INV1"), category: "impersonation", status: "investigating", created_at: ago(40), ack_at: ago(36), ack_by: ADMIN, profile_ref: "Dana", group_key: "tinder:dana", description: "Using my friend's photos." }),
  R({ ref: ref("ACT1"), category: "harassment", status: "actioned", created_at: ago(120), ack_at: ago(110), resolved_at: ago(100), decided_by: ADMIN, description: "Repeated unwanted messages.", profile_ref: "Pat", group_key: "tinder:pat" }),
  R({ ref: ref("DIS1"), category: "other", status: "dismissed", created_at: ago(90), ack_at: ago(80), resolved_at: ago(70), decided_by: ADMIN, description: "I just did not like his profile." }),
  R({ ref: ref("APL1"), category: "harassment", status: "appealed", created_at: ago(60), ack_at: ago(55), resolved_at: ago(50), decided_by: ADMIN, matched_user_id: sam.id, profile_ref: "Sam", group_key: "tinder:sam", description: "Sent threatening messages after being told to stop.", appeal_text: "I sent two messages and apologised. I did not threaten anyone, please look again.", appealed_at: ago(24) })
]);
const byRef = (suffix) => seeded.find((r) => r.ref.includes(suffix));
const samReport = byRef("APL1");
const apl = { ...samReport };
await fetch(`${MOCK}/rest/v1/profiles?user_id=eq.${sam.id}`, { method: "PATCH", headers: KEY, body: JSON.stringify({ report_hold_report_id: apl.id }) });
// A second closed-account report (appeal window still open, no appeal yet) to show the notice with the form.
const jakeReport = byRef("OVD1");
await rest("reports_events", [
  { report_id: byRef("URG1").id, actor: "reporter", action: "created", note: null, detail: { anonymous: false, attachment: false, related: 0 }, at: ago(6) },
  { report_id: apl.id, actor: "reporter", action: "created", note: null, detail: null, at: ago(60) },
  { report_id: apl.id, actor: ADMIN, action: "close_account", note: "Confirmed from the chat export the reporter attached.", detail: { from: "acknowledged", to: "actioned" }, at: ago(50) },
  { report_id: apl.id, actor: "user", action: "appealed", note: null, detail: { previous_status: "actioned" }, at: ago(24) }
]);

const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const mobile = kind === "mobile";
const newContext = () => browser.newContext(mobile ? { ...pw.devices["iPhone 14"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1440, height: 900 } });
const log = { kind, console: [], checks: {} };
async function open(context) {
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") log.console.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => log.console.push(`pageerror: ${e.message.slice(0, 200)}`));
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:" ? route.continue() : route.abort();
  });
  return page;
}
const shot = async (page, name, full = true) => {
  await page.waitForTimeout(900); // let the page transition finish
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: path.join(outDir, `${name}-${kind}.png`), fullPage: full });
};
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- public form ----
{
  const ctx = await newContext();
  const page = await open(ctx);
  await page.goto(`${APP}/report`);
  await page.getByRole("heading", { name: "Report a violation." }).waitFor();
  log.checks.formOverflowPx = await overflow(page);
  await shot(page, "1-report-form");
  // keyboard only: tab reaches the honeypot never, and radios are operable with arrows + space
  await page.keyboard.press("Tab"); // skip link or header, just prove focus moves through controls
  const tabbable = await page.evaluate(() => [...document.querySelectorAll("form input, form select, form textarea, form button")].filter((e) => e.tabIndex >= 0 && !e.closest("[aria-hidden=true]")).length);
  log.checks.tabbableControls = tabbable;
  log.checks.honeypotInTabOrder = await page.evaluate(() => document.getElementById("website")?.tabIndex);
  // validation
  await page.getByRole("button", { name: "Send report" }).click();
  await page.getByRole("alert").first().waitFor();
  log.checks.errorsShown = await page.getByText("Choose a category.").isVisible();
  log.checks.focusOnSummary = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  await shot(page, "2-report-validation");
  // emergency guidance
  await page.getByLabel("A profile on a dating app").check();
  await page.getByLabel(/Minor safety/).check();
  await page.getByLabel("Someone is in danger or has been threatened right now").check();
  await page.getByLabel("Which dating app?").selectOption("tinder");
  await page.getByLabel(/Profile name or link/).fill("Alex");
  await page.getByLabel("What happened?").fill("The profile says 16 in the bio. Reporting from a synthetic test.");
  log.checks.guidanceShown = await page.getByTestId("emergency-guidance").isVisible();
  await shot(page, "3-report-emergency-guidance");
  // bad attachment is refused in the browser, nothing is sent
  await page.getByLabel(/^Image/).setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
  await page.getByRole("button", { name: "Send report" }).click();
  log.checks.badFileRefused = await page.locator("#err-attachment").waitFor({ timeout: 5000 }).then(() => true, () => false);
  await shot(page, "4-report-bad-file");
  await page.getByLabel(/^Image/).setInputFiles([]);
  // submit anonymously, the button disables while in flight
  const submit = page.getByRole("button", { name: "Send report" });
  await submit.click();
  await page.getByTestId("report-confirmation").waitFor({ timeout: 15000 });
  log.checks.reference = (await page.getByTestId("report-ref").textContent())?.trim();
  log.checks.confirmationOverflowPx = await overflow(page);
  await shot(page, "5-report-confirmation");
  await ctx.close();
}
// honeypot + flood (API level, no browser)
{
  const before = (await mock("/__state")).db.reports.length;
  const fd = new FormData(); fd.set("subjectKind", "profile"); fd.set("category", "other"); fd.set("description", "bot"); fd.set("website", "x");
  const res = await fetch(`${APP}/api/report`, { method: "POST", body: fd });
  log.checks.honeypotStatus = res.status; log.checks.honeypotStored = (await mock("/__state")).db.reports.length - before;
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const f = new FormData(); f.set("subjectKind", "profile"); f.set("category", "other"); f.set("description", `flood ${i}`);
    codes.push((await fetch(`${APP}/api/report`, { method: "POST", body: f, headers: { "x-forwarded-for": "198.51.100.99" } })).status);
  }
  log.checks.floodStatuses = codes;
}

// ---- admin ----
const adminCtx = await newContext();
const admin = await open(adminCtx);
await admin.goto(`${APP}/admin/login`);
await admin.locator('input[name="email"]').fill(ADMIN);
for (let i = 0; i < 4; i++) {
  await admin.getByRole("button", { name: /Email me a sign-in link/ }).click({ timeout: 3000 }).catch(() => {});
  if (await admin.locator('input[name="code"]').waitFor({ timeout: 5000 }).then(() => true, () => false)) break;
}
const mail = await mock("/__outbox");
const code = [...mail.email].reverse().find((m) => m.to.includes(ADMIN))?.text.match(/\b(\d{6,10})\b/)?.[1];
if (!code) throw new Error("no admin code in the mock outbox");
await admin.locator('input[name="code"]').fill(code);
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.waitForURL("**/admin", { timeout: 20000 });

await admin.goto(`${APP}/admin/reports`);
await admin.getByRole("heading", { name: "Reports" }).waitFor();
const order = await admin.locator("tbody tr td:first-child a").allTextContents();
log.checks.queueOrder = order;
log.checks.urgentRowsHighlighted = await admin.locator("tr[data-urgent=true]").count();
log.checks.overdueRows = await admin.locator("tr[data-overdue=true]").count();
log.checks.queueOverflowPx = await overflow(admin);
await shot(admin, "6-admin-queue");
await admin.goto(`${APP}/admin/reports?status=open&category=scam_fraud`);
await admin.getByRole("heading", { name: "Reports" }).waitFor();
log.checks.filteredRows = await admin.locator("tbody tr").count();
await shot(admin, "7-admin-queue-filtered");

// detail: urgent minor safety (NCMEC panel + actions), then act on it
await admin.goto(`${APP}/admin/reports/${byRef("URG1").id}`);
await admin.getByTestId("ncmec-panel").waitFor();
log.checks.detailOverflowPx = await overflow(admin);
await shot(admin, "8-admin-detail-minor-safety");
const box = admin.getByTestId("action-acknowledge");
await box.getByRole("button", { name: "Acknowledge" }).click();
await box.getByText("Internal note").waitFor();
log.checks.noteRequiredBlocksSubmit = await box.locator("textarea[name=note]").evaluate((el) => el.validity.valueMissing);
await box.locator("textarea[name=note]").fill("Looking at the profile now.");
await box.getByRole("button", { name: "Acknowledge" }).click();
// The decision re-renders the page: the action disappears and the audit log gains a line.
await admin.getByTestId("action-acknowledge").waitFor({ state: "detached", timeout: 15000 });
const ncmec = admin.getByTestId("action-record_ncmec");
await ncmec.locator("input[name=ncmecId]").fill("CT-4455667788");
await ncmec.locator("textarea[name=note]").fill("Filed on the CyberTipline by me.");
await ncmec.getByRole("button", { name: "Record NCMEC filing" }).click();
await admin.getByTestId("ncmec-recorded").waitFor({ timeout: 30000 });
await admin.reload();
await admin.getByTestId("ncmec-panel").waitFor({ timeout: 30000 });
log.checks.ncmecRecorded = await admin.getByTestId("ncmec-recorded").isVisible();
await shot(admin, "9-admin-detail-after-actions");

// detail: a client-linked scam report with a pause action + grouped related report
await admin.goto(`${APP}/admin/reports/${jakeReport.id}`);
await admin.getByTestId("related-reports").waitFor();
await shot(admin, "10-admin-detail-linked-client");

// appeal with the same-admin warning (the original decision was made by this admin)
await admin.goto(`${APP}/admin/reports/${apl.id}`);
await admin.getByTestId("appeal-panel").waitFor();
log.checks.sameAdminWarning = await admin.getByTestId("same-admin-warning").isVisible();
await shot(admin, "11-admin-appeal-same-admin");

// ---- the user's appeal notice ----
async function signIn(page, email) {
  await page.goto(`${APP}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.locator('input[name="code"]').waitFor({ timeout: 15000 });
  let c;
  // /login answers before the mail goes out, so wait for it.
  for (let i = 0; i < 40 && !c; i++) {
    const m = await mock("/__outbox");
    c = [...m.email].reverse().find((x) => x.to.includes(email))?.text.match(/\b(\d{6,10})\b/)?.[1];
    if (!c) await new Promise((r) => setTimeout(r, 250));
  }
  await page.locator('input[name="code"]').fill(c);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home", { timeout: 20000 });
}
{
  // Sam: closed account, appeal already submitted (appealed). Jake: paused, can appeal now.
  const ctx = await newContext(); const page = await open(ctx);
  await signIn(page, sam.email);
  await page.getByTestId("hold-notice").waitFor();
  log.checks.closedHidesApp = (await page.locator(".app-main").innerText()).trim().length === 0;
  log.checks.closedAppealSubmitted = await page.getByText(/We have your appeal/).isVisible();
  await shot(page, "12-app-notice-closed-appealed", false);
  await ctx.close();
}
{
  await fetch(`${MOCK}/rest/v1/reports?id=eq.${jakeReport.id}`, { method: "PATCH", headers: KEY, body: JSON.stringify({ status: "actioned", resolved_at: ago(2), decided_by: "other-admin@example.test" }) });
  await fetch(`${MOCK}/rest/v1/profiles?user_id=eq.${jake.id}`, { method: "PATCH", headers: KEY, body: JSON.stringify({ report_hold: "paused", report_hold_report_id: jakeReport.id, report_hold_at: ago(2) }) });
  const ctx = await newContext(); const page = await open(ctx);
  await signIn(page, jake.email);
  await page.getByTestId("hold-notice").waitFor();
  log.checks.pausedKeepsApp = await page.locator(".app-main").innerText().then((t) => t.trim().length > 0);
  log.checks.noticeOverflowPx = await overflow(page);
  await shot(page, "13-app-notice-paused-appeal-form", false);
  const send = page.getByRole("button", { name: "Send appeal" });
  await page.getByLabel("Appeal this decision").fill("This was a misunderstanding, I can show my chat history.");
  await send.click();
  await page.getByText(/Appeal received for/).waitFor({ timeout: 15000 });
  await shot(page, "14-app-notice-appeal-sent", false);
  const state = await mock("/__state");
  const row = state.db.reports.find((r) => r.id === jakeReport.id);
  log.checks.appealStatus = row.status;
  await ctx.close();
}
log.checks.opsTelegramLines = (await mock("/__outbox")).telegram?.length ?? null;
fs.writeFileSync(path.join(outDir, `reports-${kind}.json`), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log.checks, null, 2));
await browser.close();
