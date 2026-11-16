// Submit every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver).
// Usage: node scripts/indexnow.mjs [--if-changed]   --if-changed: skip unless the sitemap differs from the last submission.
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
const HOST = "www.noswipe.app";
const KEY = "f5d5591e76ae4f718f54d01e2a7e4602"; // served from public/<key>.txt
const STATE = path.join(os.homedir(), ".cache", "noswipe-indexnow.hash");
const ifChanged = process.argv.includes("--if-changed");
const sm = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) { console.log("[indexnow] empty sitemap, nothing to submit"); process.exit(1); }
const hash = crypto.createHash("sha256").update(urlList.join("\n") + "\n" + [...sm.matchAll(/<lastmod>([^<]+)/g)].map((m) => m[1]).join(",")).digest("hex");
if (ifChanged && fs.existsSync(STATE) && fs.readFileSync(STATE, "utf8").trim() === hash) { console.log("[indexnow] sitemap unchanged, skipped"); process.exit(0); }
const keyLocation = `https://${HOST}/${KEY}.txt`;
const kr = await fetch(keyLocation);
if (!kr.ok || (await kr.text()).trim() !== KEY) { console.log(`[indexnow] key file not served at ${keyLocation} (HTTP ${kr.status}); not submitting`); process.exit(1); }
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ host: HOST, key: KEY, keyLocation, urlList }) });
console.log(`[indexnow] ${new Date().toISOString()} submitted ${urlList.length} urls, HTTP ${r.status}`);
if (r.status === 200 || r.status === 202) { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, hash + "\n"); }
else process.exit(1);
