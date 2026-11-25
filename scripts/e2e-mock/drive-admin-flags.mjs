// Drives /admin/clients against the local mock stack after `drive-pack.mjs <out> <kind> flagged` has left a user with a
// flagged photo: Flagged filter, the per-client flagged photo (which photo, why) and Approve / Remove. Mock only, SYNTHETIC
// solid-colour photos, admin@example.test; the real Supabase and Anthropic are never reached.
//
//   ADMIN_EMAILS=admin@example.test (set when starting `next dev`)
//   PW_CORE=/path/to/playwright-core PW_CHROMIUM_PATH=/path/to/chrome node scripts/e2e-mock/drive-admin-flags.mjs <outDir> [desktop|mobile] [approve|remove]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [outDir, kind = "desktop", decision = "none"] = process.argv.slice(2);
if (!outDir) { console.error("usage: drive-admin-flags.mjs <outDir> [desktop|mobile] [approve|remove]"); process.exit(2); }
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_CORE || "playwright-core");
const APP = "http://localhost:3000";
const MOCK = "http://127.0.0.1:54399";
const ADMIN = "admin@example.test";
fs.mkdirSync(outDir, { recursive: true });

const mock = (p, init) => fetch(`${MOCK}${p}`, init).then((r) => r.json());
await fetch(`${MOCK}/auth/v1/admin/users`, { method: "POST", headers: { "Content-Type": "application/json", apikey: "mock-service-key", Authorization: "Bearer mock-service-key" }, body: JSON.stringify({ email: ADMIN }) });
const before = await mock("/__state");
const flagged = before.db.photo_flags.find((f) => f.status === "flagged");
if (!flagged) { console.error("no flagged photo in the mock: run drive-pack.mjs flagged first"); process.exit(1); }

const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const context = await browser.newContext(kind === "mobile" ? { ...pw.devices["iPhone 14"], viewport: { width: 375, height: 812 } } : { viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const log = { kind, decision, console: [], checks: {} };
page.on("console", (m) => { if (m.type() === "error") log.console.push(m.text().slice(0, 200)); });
await context.route("**/*", (route) => {
  const u = new URL(route.request().url());
  return ["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:" ? route.continue() : route.abort();
});
const shot = async (name, full = true) => {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  // Emails are masked in screenshots (the mock users are example.test, but the habit stays).
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: full, mask: [page.locator("td:nth-child(3)"), page.locator("main p.sub, main [class*=sub]").first()], maskColor: "#475569" });
};

await page.goto(`${APP}/admin/login`);
await page.locator('input[name="email"]').fill(ADMIN);
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: /Email me a sign-in link/ }).click({ timeout: 3000 }).catch(() => {});
  if (await page.locator('input[name="code"]').waitFor({ timeout: 5000 }).then(() => true, () => false)) break;
}
const mail = await mock("/__outbox");
const code = [...mail.email].reverse().find((m) => m.to.includes(ADMIN))?.text.match(/\b(\d{6,10})\b/)?.[1];
if (!code) throw new Error("no admin code in the mock outbox");
await page.locator('input[name="code"]').fill(code);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/admin", { timeout: 20000 });

await page.goto(`${APP}/admin/clients?flagged=1`);
await page.getByRole("heading", { name: "Clients" }).waitFor();
log.checks.badgeShown = await page.getByText(/^Flagged/).first().isVisible();
log.checks.filterCount = await page.locator("tbody tr").count();
await shot("1-admin-clients-flagged");

await page.goto(`${APP}/admin/clients/${flagged.user_id}`);
await page.getByTestId("flagged-photos").waitFor();
log.checks.reasonShown = await page.getByTestId("flagged-photos").getByText(/Not a real person/).isVisible();
log.checks.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await shot("2-admin-client-flagged-photo");

if (decision === "approve" || decision === "remove") {
  const label = decision === "approve" ? "Approve" : "Remove";
  const button = page.getByTestId("flagged-photos").getByRole("button", { name: label, exact: true });
  await button.click();
  // The decision revalidates the page, so the flagged section (and its result line) disappears once it is saved.
  await page.getByTestId("flagged-photos").waitFor({ state: "detached", timeout: 15000 });
  const after = await mock("/__state");
  const row = after.db.photo_flags.find((f) => f.photo_id === flagged.photo_id);
  const photo = after.db.profile_photos.find((p) => p.id === flagged.photo_id);
  log.checks.status = row?.status;
  log.checks.softDeleted = Boolean(photo?.deleted_at);
  log.checks.photoRowKept = Boolean(photo);
  await shot(`3-admin-after-${decision}`);
}
fs.writeFileSync(path.join(outDir, `admin-${kind}-${decision}.json`), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log.checks));
await browser.close();
