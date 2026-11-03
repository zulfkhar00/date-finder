// Screenshot a list of routes of a running web app - the BEFORE/AFTER helper.
//
//   node scripts/pr-shots.mjs [--mobile] <baseURL> <outDir> /route1 /route2 ...
//
// Needs `playwright` (resolved from the cwd, or from $PW_DIR). Locally:
//   npm i -D playwright && npx playwright install chromium
//   npm run dev &            # on main:   node scripts/pr-shots.mjs http://localhost:3000 shots/before /
//   (switch to your branch)  # on branch: node scripts/pr-shots.mjs http://localhost:3000 shots/after /
// Commit the PNGs under docs/screenshots/<pr>/ (before-*.png / after-*.png) or drag them into the PR body.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const [baseURL, outDir, ...routes] = args.filter((a) => a !== "--mobile");
if (!baseURL || !outDir || routes.length === 0) {
  console.error("usage: node scripts/pr-shots.mjs [--mobile] <baseURL> <outDir> /route ...");
  process.exit(2);
}
const require = createRequire(path.join(process.cwd(), "noop.js"));
const resolved = require.resolve("playwright", { paths: [process.cwd(), process.env.PW_DIR || process.cwd()] });
const mod = await import(pathToFileURL(resolved).href);
const { chromium, devices } = mod.chromium ? mod : mod.default;

const launch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
const context = await browser.newContext({
  ...(mobile ? devices["iPhone 14"] : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }),
  baseURL,
  // e.g. SHOTS_HEADERS='{"X-Hub-Proxy":"..."}' for apps behind a proxy/auth header
  ...(process.env.SHOTS_HEADERS ? { extraHTTPHeaders: JSON.parse(process.env.SHOTS_HEADERS) } : {}),
});
fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const route of routes) {
  const page = await context.newPage();
  const file = path.join(outDir, `${route.replace(/^\//, "").replace(/[^\w-]+/g, "_") || "root"}.png`);
  try {
    await page.goto(route, { waitUntil: "load", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: file, fullPage: true });
    console.log("shot", route, "->", file);
  } catch (e) {
    failed++;
    console.error("FAILED", route, String(e).split("\n")[0]);
  }
  await page.close();
}
await browser.close();
process.exit(failed === routes.length ? 1 : 0);
