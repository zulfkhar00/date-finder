// Visit quality: crawler and automation UAs (real samples), real mobile / in-app UAs that must stay human,
// the datacenter ASN list, the unengaged rule, the header-to-row path, the report filters and the backfill plan.
// No network, no database. Run with: node --conditions=react-server --import tsx scripts/check-bot-quality.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyRequest, botUserAgentReason, CLOUD_ASNS, cloudProviderFromHeaders, describeFiltered, parseAsn, planBackfill, sessionQualities, summariseFiltered, UNENGAGED_GRACE_MS, type QualityEvent } from "../src/lib/bot-quality";
import { computeCheckoutReport } from "../src/lib/checkout-report";
import { funnelRowAttempts } from "../src/lib/funnel";
import { computeRealFunnel } from "../src/lib/real-funnel";
import { parseDevice, trafficFromRequest } from "../src/lib/traffic";
import { buildTrafficModel, periodStats, type TrafficEvent } from "../src/lib/traffic-report";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const LANG = { "accept-language": "en-US,en;q=0.9" };

// ---------- User agents ----------
const CRAWLERS: [string, string][] = [
  ["HeadlessChrome", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36"],
  ["Lighthouse desktop", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Chrome-Lighthouse"],
  ["Lighthouse mobile", "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse"],
  ["PageSpeed Insights", "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 PTST/240101.123456"],
  ["Googlebot smartphone", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["Bingpreview", "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b"],
  ["AhrefsBot", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
  ["Baiduspider", "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"],
  ["YandexBot", "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"],
  ["Bytespider", "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)"],
  ["facebookexternalhit", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["Slackbot", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
  ["Discordbot", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  ["UptimeRobot", "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)"],
  ["Pingdom", "Mozilla/5.0 (compatible; PingdomPageSpeed/1.0; +http://www.pingdom.com/)"],
  ["Puppeteer marker", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Puppeteer"],
  ["Playwright marker", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Playwright/1.45"],
  ["PhantomJS", "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1"],
  ["Security scanner", "Mozilla/5.0 (compatible; Nmap Scripting Engine) scanner"],
  ["python-requests", "python-requests/2.31.0"],
  ["curl", "curl/8.4.0"],
  ["Go http client", "Go-http-client/2.0"],
  ["axios", "axios/1.6.8"],
  ["node-fetch", "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)"],
  ["wget", "Wget/1.21.4"],
  ["Monitor", "Mozilla/5.0 (compatible; SiteMonitor/1.2)"]
];
for (const [name, ua] of CRAWLERS) {
  assert.ok(botUserAgentReason(ua), `${name} is a bot UA`);
  assert.equal(parseDevice(ua), "bot", `${name}: device bot`);
  assert.equal(classifyRequest(h({ "user-agent": ua, ...LANG })).quality, "bot", `${name}: quality bot even with a language header`);
}

const HUMANS: [string, string][] = [
  ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"],
  ["iPhone Chrome", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1"],
  ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"],
  ["Instagram iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 360.0.0.30.109 (iPhone15,3; iOS 18_1; en_US; en-US; scale=3.00; 1290x2796; 677203457)"],
  ["Instagram Android", "Mozilla/5.0 (Linux; Android 14; SM-G991B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 360.0.0.52.192 Android (34/14; 420dpi; 1080x2209; samsung; SM-G991B; o1s; exynos2100; en_US; 678923407)"],
  ["Facebook in-app", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.40.108;FBBV/600000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]"],
  ["TikTok in-app", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_36.0.0 BytedanceWebview/d8a21c6"],
  ["Desktop Chrome", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"],
  ["Desktop Firefox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"],
  ["Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"],
  ["Cubot phone (brand ends in bot)", "Mozilla/5.0 (Linux; Android 13; CUBOT KingKong 9 Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"],
  ["Cubot lowercase", "Mozilla/5.0 (Linux; Android 12; Cubot X70) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"]
];
for (const [name, ua] of HUMANS) {
  assert.equal(botUserAgentReason(ua), null, `${name} is not a bot UA`);
  assert.notEqual(parseDevice(ua), "bot", `${name}: not device bot`);
  const r = classifyRequest(h({ "user-agent": ua, ...LANG }));
  assert.equal(r.quality, "human", `${name}: human (${r.reasons.join(",")})`);
}

// ---------- Language, missing UA ----------
const SAFARI = HUMANS[0][1];
assert.equal(classifyRequest(h({ "user-agent": SAFARI })).quality, "suspect", "browser UA without Accept-Language is suspect");
assert.deepEqual(classifyRequest(h({ "user-agent": SAFARI })).reasons, ["no_accept_language"]);
assert.equal(classifyRequest(h({ "user-agent": SAFARI, "accept-language": "  " })).quality, "suspect", "blank language");
assert.equal(classifyRequest(h({ ...LANG })).quality, "bot", "no UA at all");
assert.equal(trafficFromRequest({}, h({ ...LANG })).device, "bot", "no UA: stored as device bot");

// ---------- ASN list ----------
assert.equal(parseAsn("AS16509"), 16509);
assert.equal(parseAsn("16509"), 16509);
assert.equal(parseAsn(" as 14061 "), 14061);
assert.equal(parseAsn("AS"), null);
assert.equal(parseAsn("abc"), null);
assert.equal(parseAsn(null), null);
assert.equal(parseAsn("0"), null);
const ASN_CASES: [number, string][] = [[37963, "Alibaba Cloud"], [45102, "Alibaba Cloud"], [45090, "Tencent Cloud"], [132203, "Tencent Cloud"], [55990, "Huawei Cloud"], [136907, "Huawei Cloud"], [16509, "AWS"], [396982, "Google Cloud"], [8075, "Microsoft Azure"], [14061, "DigitalOcean"], [16276, "OVH"], [24940, "Hetzner"]];
for (const [asn, provider] of ASN_CASES) {
  assert.equal(CLOUD_ASNS.get(asn), provider);
  assert.equal(cloudProviderFromHeaders(h({ "x-vercel-ip-as-number": String(asn) })), provider);
  // datacenter alone: suspect (a person on a VPN or a corporate cloud desktop is possible)
  assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-ip-as-number": String(asn) })).quality, "suspect", `${provider}: suspect`);
  // datacenter + no language: clear bot
  assert.equal(classifyRequest(h({ "user-agent": SAFARI, "x-vercel-ip-as-number": `AS${asn}` })).quality, "bot", `${provider} without language: bot`);
}
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-ip-as-number": "7922" })).quality, "human", "Comcast residential ASN stays human");
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-ip-as-number": "714" })).quality, "human", "Apple / iCloud Private Relay is not in the list");
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-ip-as-number": "garbage" })).quality, "human", "an unreadable ASN header does nothing");
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-waf-source": "vpn" })).quality, "human", "a plain VPN is not suspicious");
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-waf-source": "vpn, res-proxy" })).quality, "suspect", "residential proxy network");
assert.equal(classifyRequest(h({ "user-agent": SAFARI, ...LANG, "x-vercel-waf-source": "tor" })).quality, "suspect");

// ---------- trafficFromRequest wiring ----------
const human = trafficFromRequest({}, h({ "user-agent": SAFARI, ...LANG, "cf-ipcountry": "US" }));
assert.equal(human.quality, "human");
assert.equal(human.device, "mobile");
const bot = trafficFromRequest({}, h({ "user-agent": CRAWLERS[0][1], ...LANG, "x-vercel-ip-country": "CN" }));
assert.equal(bot.quality, "bot");
assert.equal(bot.device, "bot");
const suspect = trafficFromRequest({}, h({ "user-agent": SAFARI, "x-vercel-ip-as-number": "16509", ...LANG }));
assert.equal(suspect.quality, "suspect");
assert.equal(suspect.device, "mobile", "suspect keeps its real device class");
assert.equal(JSON.stringify(human).includes("Mozilla"), false, "no UA stored");

// ---------- Insert falls back when the column is missing ----------
const attempts = funnelRowAttempts({ event: "page_view", sessionId: "11111111-1111-4111-8111-111111111111", traffic: { device: "mobile", country: "US", quality: "suspect", in_app_source: "instagram" } });
assert.equal(attempts[0].quality, "suspect");
assert.equal(attempts[1].quality, undefined, "quality is the first column dropped");
assert.equal(attempts[1].in_app_source, "instagram", "older traffic columns keep flowing");
assert.equal(attempts[1].device, "mobile");

// ---------- Unengaged rule ----------
const T0 = Date.parse("2026-11-20T10:00:00Z");
const NOW = T0 + 3 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
let n = 0;
const sid = (i: number) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`;
const ev = (i: number, event: string, extra: Partial<TrafficEvent> = {}, at = T0): TrafficEvent => ({
  created_at: iso(at + n++), event, session_id: sid(i), variant: "noswipe", utm_campaign: null, dedupe_key: null, ...extra
});
const direct = { device: "mobile", landing_path: "/", country: "US" };
const events: TrafficEvent[] = [
  ev(1, "page_view", { ...direct, country: "CN" }),                                                      // unengaged direct: suspect
  ev(2, "page_view", { ...direct }), ev(2, "get_started", { device: "mobile" }),                         // engaged
  ev(3, "page_view", { ...direct, utm_source: "instagram" }),                                            // one view but tagged: a real bounce
  ev(4, "page_view", { ...direct, referrer_host: "l.instagram.com" }),                                   // one view with a referrer: human
  ev(5, "page_view", { ...direct, in_app_source: "instagram" }),                                         // in-app: human
  ev(6, "page_view", { ...direct, device: "bot" }),                                                      // bot
  ev(7, "page_view", { ...direct }, NOW - 60_000),                                                       // too young to judge
  ev(8, "page_view", { country: null }),                                                                 // legacy row, nothing captured: not flagged
  ev(9, "page_view", { ...direct }), ev(9, "page_view", { ...direct }, T0 + 5_000),                      // two page views: engaged
  ev(10, "page_view", { ...direct, quality: "suspect" }),                                                // stored suspect (e.g. datacenter)
  ev(11, "page_view", { ...direct, quality: "human" }),                                                  // stored human but unengaged direct
  ev(12, "page_view", { ...direct, quality: "suspect", utm_source: "instagram" }), ev(12, "checkout_created", { dedupe_key: "checkout_created:cs_live_12" }), ev(12, "paid", { dedupe_key: "paid:cs_live_12" }),
  ev(13, "page_view", { ...direct, quality: "suspect", utm_source: "instagram" }), ev(13, "checkout_created", { dedupe_key: "checkout_created:cs_live_13" }) // unpaid checkout from a suspect session
];
const q = sessionQualities(events, NOW);
const of = (i: number) => q.get(sid(i))!;
assert.equal(of(1).quality, "suspect"); assert.deepEqual(of(1).reasons, ["unengaged_direct"]);
assert.equal(of(2).quality, "human");
assert.equal(of(3).quality, "human", "one page view with a utm tag is a bounce, not a bot");
assert.equal(of(4).quality, "human");
assert.equal(of(5).quality, "human");
assert.equal(of(6).quality, "bot");
assert.equal(of(7).quality, "human", "a visit younger than the grace period is not judged");
assert.equal(of(8).quality, "human", "no traffic fields captured: cannot call it direct");
assert.equal(of(9).quality, "human");
assert.equal(of(10).quality, "suspect");
assert.equal(of(11).quality, "suspect", "behaviour overrides a stored human");
assert.equal(of(12).quality, "human", "a paid session is never hidden by a doubt"); assert.ok(of(12).reasons.includes("paid"));
assert.equal(of(13).quality, "suspect");
assert.ok(UNENGAGED_GRACE_MS >= 30 * 60_000);

// ---------- Filter summary + sentence ----------
const off = summariseFiltered(q, { includeSuspect: false });
assert.equal(off.bot, 1);
assert.equal(off.suspect, 4);
assert.equal(summariseFiltered(q, { includeSuspect: true }).suspect, 0, "included suspects are not 'left out'");
assert.equal(summariseFiltered(q, { includeSuspect: false }, (at) => at > NOW).bot, 0, "range filter");
const sentence = describeFiltered(off)!;
assert.match(sentence, /1 bot session and 4 suspect sessions left out/);
assert.match(sentence, /one page view, no source, no interaction: 3/);
assert.equal(describeFiltered({ bot: 0, suspect: 0, reasons: {} }), null);

// ---------- Traffic report ----------
const model = buildTrafficModel(events, [], undefined, { nowMs: NOW });
const span = (m: typeof model) => periodStats(m, T0 - 1000, NOW + 1000).totals.visitors;
// humans: 2,3,4,5,7,8,9,12 = 8
assert.equal(span(model), 8, "default: human only");
const withSuspect = buildTrafficModel(events, [], undefined, { nowMs: NOW, includeSuspect: true });
assert.equal(span(withSuspect), 12, "include suspect: + 1, 10, 11, 13 (bot 6 never)");
assert.equal(withSuspect.sessions.has(sid(6)), false, "bots are never counted");

// ---------- Overview funnel ----------
const funnel = computeRealFunnel(events, [], 30, new Date(NOW));
assert.equal(funnel.visitors, 8);
assert.equal(funnel.qualityFiltered.bot, 1);
assert.equal(funnel.qualityFiltered.suspect, 4);
assert.equal(funnel.suspectSessions, 4);
const funnelAll = computeRealFunnel(events, [], 30, new Date(NOW), undefined, { includeSuspect: true });
assert.equal(funnelAll.visitors, 12);
assert.equal(funnelAll.suspectSessions, 0);

// ---------- Checkout panel: unpaid checkouts from suspect sessions are hidden, paid never ----------
const cs = (i: number, event: string, key: string): TrafficEvent => ev(i, event, { dedupe_key: key });
const checkoutEvents = [
  ev(21, "page_view", { ...direct, utm_source: "instagram" }), cs(21, "checkout_created", "checkout_created:cs_live_21"),
  ev(22, "page_view", { ...direct, utm_source: "instagram", quality: "suspect" }), cs(22, "checkout_created", "checkout_created:cs_live_22"),
  ev(23, "page_view", { ...direct, utm_source: "instagram", quality: "suspect" }), cs(23, "checkout_created", "checkout_created:cs_live_23"), cs(23, "paid", "paid:cs_live_23")
].map((e) => ({ ...e, detail: null }));
const panel = computeCheckoutReport(checkoutEvents, [], new Date(NOW), 30);
assert.equal(panel.steps[0].count, 2, "21 and the paid 23; the unpaid suspect 22 is hidden");
assert.equal(panel.excluded.suspect, 1);
assert.equal(panel.steps[3].count, 1, "paid is counted");
const panelAll = computeCheckoutReport(checkoutEvents, [], new Date(NOW), 30, { includeSuspect: true });
assert.equal(panelAll.steps[0].count, 3);
assert.equal(panelAll.excluded.suspect, 0);

// ---------- Backfill plan ----------
const rows: QualityEvent[] = events.map((e) => ({ ...e }));
const plan = planBackfill(rows, NOW);
assert.equal(plan.byQuality.bot, 1);
assert.equal(plan.byQuality.suspect, 4);
assert.equal(plan.byQuality.human, 8);
assert.equal(plan.sessions, 13);
assert.equal(plan.countries.CN?.suspect, 1, "per-country breakdown");
const updates = new Map(plan.updates.map((u) => [u.sessionId, u.quality]));
assert.equal(updates.get(sid(1)), "suspect");
assert.equal(updates.get(sid(11)), "suspect", "stored human is raised");
assert.equal(updates.has(sid(10)), false, "already stored suspect: nothing to write");
assert.equal(updates.get(sid(6)), "bot");
assert.equal(updates.has(sid(2)), false, "humans are not written");
assert.ok(plan.pageViewSessions.after < plan.pageViewSessions.before);

// ---------- Wiring ----------
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/2026-11-22-session-quality.sql");
assert.match(migration, /add column if not exists quality text/);
assert.match(migration, /drop constraint if exists funnel_events_quality_check/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.funnel_events from public, anon, authenticated/);
assert.doesNotMatch(migration, /drop table|delete from|truncate/i, "additive only");
assert.match(read("../src/app/api/event/route.ts"), /trafficFromRequest/);
assert.match(read("./backfill-session-quality.ts"), /const apply = args\.includes\("--apply"\)/);

console.log("bot quality checks passed");
