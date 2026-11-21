import assert from "node:assert/strict";
import { funnelRowAttempts } from "../src/lib/funnel";
import {
  firstTouchFromTraffic, inAppSource, normalizeChannel, parseFirstTouch, privacySignal, resolveChannel, serializeFirstTouch, shouldSetFirstTouch, trafficFromRequest
} from "../src/lib/traffic";
import { buildTrafficModel, periodStats, DAY, type TrafficEvent } from "../src/lib/traffic-report";
import { buildUtmLink, slugUtm } from "../src/lib/utm-links";

// ---- real in-app browser User-Agents ----
const UA = {
  instagramIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.2.20.116 (iPhone14,2; iOS 17_5; en_US; en-US; scale=3.00; 1170x2532; 636034795) AppleWebKit/420+",
  instagramAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Instagram 340.0.0.30.109 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 654321987)",
  facebookIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.35.108;FBBV/600000000;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/465.0.0.40.109;]",
  messenger: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0.0.0.0;FBBV/580000000;FBDV/iPhone14,2]",
  tiktokIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US RevealType/Dialog isDarkMode/1 WKWebView/1 BytedanceWebview/d8a21c6",
  tiktokAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 trill_2023405030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.5.3 ByteLocale/en-US",
  threads: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.1.18.102 (iPhone14,2; iOS 17_5; en_US; en-US; scale=3.00; 1170x2532; 640000000)",
  linkedin: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp/9.30.1234",
  snapchat: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.90.0.38 (like Safari/8618.2.12.0.2, iPhone14,2; iOS 17.5; gzip)",
  twitterIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.45.1",
  telegramAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Telegram-Android/10.14.5 (Google Pixel 8; Android 14; SDK 34; HIGH)",
  whatsapp: "WhatsApp/2.24.12.78 A",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  facebookPreview: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  twitterbot: "Twitterbot/1.0",
  telegrambot: "TelegramBot (like TwitterBot)",
  instagramBot: "Mozilla/5.0 (compatible; Instagram bot; +https://www.instagram.com/)"
};

assert.equal(inAppSource(UA.instagramIos), "instagram");
assert.equal(inAppSource(UA.instagramAndroid), "instagram");
assert.equal(inAppSource(UA.facebookIos), "facebook");
assert.equal(inAppSource(UA.facebookAndroid), "facebook");
assert.equal(inAppSource(UA.messenger), "facebook");
assert.equal(inAppSource(UA.tiktokIos), "tiktok");
assert.equal(inAppSource(UA.tiktokAndroid), "tiktok");
assert.equal(inAppSource(UA.threads), "threads");
assert.equal(inAppSource(UA.linkedin), "linkedin");
assert.equal(inAppSource(UA.snapchat), "snapchat");
assert.equal(inAppSource(UA.twitterIos), "x");
assert.equal(inAppSource(UA.telegramAndroid), "telegram");
assert.equal(inAppSource(UA.whatsapp), "whatsapp");
for (const plain of [UA.safari, UA.chrome, "", null, undefined]) assert.equal(inAppSource(plain), null, "plain browsers stay unknown");
for (const bot of [UA.facebookPreview, UA.twitterbot, UA.telegrambot, UA.instagramBot]) assert.equal(inAppSource(bot), null, `crawler is never an app: ${bot}`);

// ---- trafficFromRequest: utm and referrer beat the UA guess; self-referral is ignored ----
const h = (ua: string, extra: Record<string, string> = {}) => ({ get: (n: string) => ({ "user-agent": ua, ...extra })[n.toLowerCase()] ?? null });
assert.equal(trafficFromRequest({ landingPath: "/" }, h(UA.instagramIos)).in_app_source, "instagram", "no utm, no referrer -> UA guess");
assert.equal(trafficFromRequest({ utmSource: "reddit" }, h(UA.instagramIos)).in_app_source, null, "utm overrides the UA guess");
assert.equal(trafficFromRequest({ referrer: "https://www.google.com/" }, h(UA.instagramIos)).in_app_source, null, "a real referrer overrides the UA guess");
assert.equal(trafficFromRequest({ referrer: "https://noswipe.app/guides/x" }, h(UA.tiktokIos)).in_app_source, "tiktok", "self-referral is ignored, so the UA guess still applies");
assert.equal(trafficFromRequest({ referrer: "https://noswipe.app/guides/x" }, h(UA.safari)).referrer_host, null);
assert.equal(trafficFromRequest({}, h(UA.safari)).in_app_source, null, "unknown stays unknown (reported as direct)");
// The UA and IP never come back out.
const out = trafficFromRequest({ landingPath: "/" }, h(UA.instagramIos, { "x-forwarded-for": "203.0.113.9", "x-vercel-ip-country": "US" }));
assert.ok(!JSON.stringify(out).includes("Instagram 345"), "raw UA is not in the output");
assert.ok(!JSON.stringify(out).includes("203.0.113.9"), "IP is not in the output");
assert.equal(out.device, "mobile");
assert.equal(out.country, "US");

// ---- channel resolution ----
assert.equal(resolveChannel(null, null, null), "direct");
assert.equal(resolveChannel(null, null, "instagram"), "instagram");
assert.equal(resolveChannel("seo", null, "instagram"), "seo", "utm wins");
assert.equal(resolveChannel(null, "l.instagram.com", "tiktok"), "instagram", "referrer wins over the UA guess");
assert.equal(normalizeChannel("Product Hunt".replace(" ", "-")), "producthunt");
assert.equal(normalizeChannel("www.producthunt.com"), "producthunt");
assert.equal(normalizeChannel("t.me"), "telegram");
assert.equal(normalizeChannel("lm.facebook.com"), "facebook");

// ---- first touch ----
const igFt = firstTouchFromTraffic(trafficFromRequest({ landingPath: "/guides/tinder-bio" }, h(UA.instagramIos)), null);
assert.deepEqual(igFt, { source: "instagram", medium: "in-app", campaign: null, landing: "/guides/tinder-bio" });
const utmFt = firstTouchFromTraffic(trafficFromRequest({ utmSource: "seo", utmMedium: "guide", landingPath: "/guides/x" }, h(UA.safari)), "x-guide");
assert.deepEqual(utmFt, { source: "seo", medium: "guide", campaign: "x-guide", landing: "/guides/x" });
assert.deepEqual(firstTouchFromTraffic(trafficFromRequest({ referrer: "https://news.ycombinator.com/", landingPath: "/" }, h(UA.chrome)), null), { source: "news.ycombinator.com", medium: "referral", campaign: null, landing: "/" });
assert.equal(firstTouchFromTraffic(trafficFromRequest({ landingPath: "/" }, h(UA.safari)), null).source, "direct");

const header = `a=b; ns_ft=${encodeURIComponent(serializeFirstTouch(utmFt))}; c=d`;
assert.deepEqual(parseFirstTouch(header), utmFt, "round-trips through a Cookie header");
assert.equal(parseFirstTouch(undefined), null);
assert.equal(parseFirstTouch("a=b"), null);
assert.equal(parseFirstTouch("ns_ft=%7Bbroken"), null, "garbage never throws");
assert.equal(parseFirstTouch(`ns_ft=${encodeURIComponent(JSON.stringify(["<script>", null, null, null]))}`), null, "tokens are validated");
assert.equal(parseFirstTouch(`ns_ft=${encodeURIComponent(JSON.stringify(["x", null, null, "//evil.com"]))}`)?.landing, null, "landing must be a path");

// ---- privacy: DNT / GPC ----
assert.equal(privacySignal(h(UA.safari, { dnt: "1" })), true);
assert.equal(privacySignal(h(UA.safari, { "sec-gpc": "1" })), true);
assert.equal(privacySignal(h(UA.safari, { dnt: "0" })), false);
assert.equal(privacySignal(h(UA.safari)), false);

// ---- when the first-touch cookie is set ----
const SID = "11111111-1111-4111-8111-111111111111";
const base = { event: "page_view", sessionId: SID, device: "mobile" as const, cookieHeader: null, headers: h(UA.safari) };
assert.equal(shouldSetFirstTouch(base), true, "first page_view, nothing stored");
assert.equal(shouldSetFirstTouch({ ...base, cookieHeader: header }), false, "an existing first touch is never overwritten");
assert.equal(shouldSetFirstTouch({ ...base, cookieHeader: "ns_ft=garbage" }), true, "a corrupt cookie is replaced");
assert.equal(shouldSetFirstTouch({ ...base, event: "get_started" }), false, "only on page_view");
assert.equal(shouldSetFirstTouch({ ...base, device: "bot" }), false, "never for crawlers");
assert.equal(shouldSetFirstTouch({ ...base, sessionId: "00000000-1111-4111-8111-111111111111" }), false, "never for probe sessions");
assert.equal(shouldSetFirstTouch({ ...base, headers: h(UA.safari, { dnt: "1" }) }), false, "Do-Not-Track");
assert.equal(shouldSetFirstTouch({ ...base, headers: h(UA.safari, { "sec-gpc": "1" }) }), false, "Global Privacy Control");

// ---- funnel rows: new columns drop first, older traffic columns survive ----
const attempts = funnelRowAttempts({
  event: "checkout_created", sessionId: "11111111-1111-4111-8111-111111111111",
  traffic: { in_app_source: "instagram", device: "mobile", country: "US" },
  firstTouch: { source: "instagram", medium: "in-app", campaign: null, landing: "/" }
});
assert.equal(attempts[0].first_touch_source, "instagram");
assert.equal(attempts[0].in_app_source, "instagram");
assert.ok(attempts.length >= 2);
assert.equal(attempts[1].first_touch_source, undefined);
assert.equal(attempts[1].in_app_source, undefined);
assert.equal(attempts[1].device, "mobile", "device/country keep flowing before the migration");
assert.equal(funnelRowAttempts({ event: "paid" }).length, 1, "no optional columns: a single attempt");

// ---- report: in-app source folds into the channel; bots and self traffic are excluded ----
const T0 = Date.parse("2026-11-15T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
let n = 0;
const ev = (session: string, event: string, extra: Partial<TrafficEvent> = {}, at = T0): TrafficEvent => ({
  created_at: iso(at + n++), event, session_id: session, variant: "noswipe", utm_campaign: null, dedupe_key: null, ...extra
});
const sid = (i: number) => `${String(i).padStart(8, "1")}-1111-4111-8111-111111111111`;
const events: TrafficEvent[] = [
  ev(sid(1), "page_view", { in_app_source: "instagram", device: "mobile", landing_path: "/", country: "US" }),
  ev(sid(1), "get_started", { in_app_source: "instagram", device: "mobile" }),
  ev(sid(2), "page_view", { device: "mobile", landing_path: "/", country: "IN" }),                                    // direct
  ev(sid(3), "page_view", { utm_source: "reddit", in_app_source: null, device: "mobile", landing_path: "/guides/x", country: "US" }),
  ev(sid(4), "page_view", { referrer_host: "l.instagram.com", device: "mobile", landing_path: "/", country: "US" }),
  ev(sid(5), "page_view", { device: "bot", landing_path: "/", country: "US" }),                                      // crawler: excluded
  ev("00000000-1111-4111-8111-111111111111", "page_view", { device: "desktop", landing_path: "/" })                  // probe: excluded
];
const model = buildTrafficModel(events, []);
const stats = periodStats(model, T0 - DAY, T0 + DAY);
const byKey = new Map(stats.channels.map((r) => [r.key, r]));
assert.equal(stats.totals.visitors, 4, "bot and probe sessions are not visitors");
assert.equal(byKey.get("instagram")?.visitors, 2, "in-app guess + l.instagram.com referrer fold into one source");
assert.equal(byKey.get("instagram")?.getStarted, 1);
assert.equal(byKey.get("direct")?.visitors, 1);
assert.equal(byKey.get("reddit")?.visitors, 1);
assert.deepEqual(stats.referrerHosts, [{ key: "l.instagram.com", visitors: 1 }]);
assert.equal(stats.countries.find((r) => r.key === "US")?.visitors, 3);

// ---- tagged-link builder ----
assert.equal(slugUtm("  My Reel #4!  "), "my-reel-4");
const ok = buildUtmLink({ source: "Instagram", medium: "bio", campaign: "profile" });
assert.deepEqual(ok, { ok: true, url: "https://noswipe.app/?utm_source=instagram&utm_medium=bio&utm_campaign=profile" });
const reel = buildUtmLink({ path: "/onboarding", source: "instagram", medium: "reel", campaign: "reels", content: "DAbc123" });
assert.ok(reel.ok && reel.url === "https://noswipe.app/onboarding?utm_source=instagram&utm_medium=reel&utm_campaign=reels&utm_content=dabc123");
assert.equal(buildUtmLink({ source: "", medium: "bio" }).ok, false);
assert.equal(buildUtmLink({ source: "x", medium: "" }).ok, false);
assert.equal(buildUtmLink({ path: "//evil.com", source: "x", medium: "social" }).ok, false, "never an off-site path");
assert.equal(buildUtmLink({ path: "/a?b=1", source: "x", medium: "social" }).ok, false);

console.log("traffic source checks passed");
