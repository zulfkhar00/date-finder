import assert from "node:assert/strict";
import { syncRequestSchema } from "../src/lib/content";
import { computeRealFunnel, type ReservationRow } from "../src/lib/real-funnel";
import { cleanLandingPath, countryFromHeaders, normalizeChannel, parseDevice, referrerHost, resolveChannel, trafficFromRequest } from "../src/lib/traffic";
import {
  buildTrafficModel, computeAlarms, formatDelta, liveNow, median, periodDelta, periodStats, postsPerDay, shortcodeFromUrl, DAY, HOUR, type TrafficEvent
} from "../src/lib/traffic-report";

// ---- device parsing ----
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const ANDROID_TAB = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
assert.equal(parseDevice(IPHONE), "mobile");
assert.equal(parseDevice(ANDROID), "mobile");
assert.equal(parseDevice(IPAD), "tablet");
assert.equal(parseDevice(ANDROID_TAB), "tablet");
assert.equal(parseDevice(MAC), "desktop");
assert.equal(parseDevice("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"), "bot");
assert.equal(parseDevice("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (compatible; Googlebot/2.1)"), "bot");
assert.equal(parseDevice(""), null);
assert.equal(parseDevice(null), null);

// ---- referrer host: host only, self-referrals dropped ----
assert.equal(referrerHost("https://l.instagram.com/?u=https%3A%2F%2Fnoswipe.app&e=abc"), "l.instagram.com");
assert.equal(referrerHost("https://www.Google.com/search?q=x"), "google.com");
assert.equal(referrerHost("https://noswipe.app/guides/x"), null, "self-referral");
assert.equal(referrerHost("https://www.noswipe.app/"), null, "self-referral with www");
assert.equal(referrerHost("https://morrow.zulfkhar.dev/"), null, "self-referral on the legacy host");
assert.equal(referrerHost("https://staging.example.com/", ["staging.example.com"]), null, "extra self host");
assert.equal(referrerHost("android-app://com.google.android.gm"), null);
assert.equal(referrerHost("not a url"), null);
assert.equal(referrerHost(""), null);
assert.equal(referrerHost(undefined), null);

// ---- landing path, country ----
assert.equal(cleanLandingPath("/guides/tinder-bio?utm_source=x&email=a@b.c#top"), "/guides/tinder-bio");
assert.equal(cleanLandingPath("//evil.com/x"), null);
assert.equal(cleanLandingPath("https://noswipe.app/"), null);
assert.equal(cleanLandingPath("/"), "/");
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
assert.equal(countryFromHeaders(h({ "cf-ipcountry": "kz" })), "KZ");
assert.equal(countryFromHeaders(h({ "x-vercel-ip-country": "US" })), "US");
assert.equal(countryFromHeaders(h({ "cf-ipcountry": "XX" })), null);
assert.equal(countryFromHeaders(h({ "cf-ipcountry": "T1" })), null);
assert.equal(countryFromHeaders(h({})), null);

// ---- source attribution: utm_source || referrer_host || direct ----
assert.equal(resolveChannel("instagram", "l.instagram.com"), "instagram", "utm wins");
assert.equal(resolveChannel("IG", null), "instagram", "alias");
assert.equal(resolveChannel(null, "l.instagram.com"), "instagram");
assert.equal(resolveChannel(null, "t.co"), "x");
assert.equal(resolveChannel(null, "google.co.uk"), "google");
assert.equal(resolveChannel(null, "news.ycombinator.com"), "news.ycombinator.com");
assert.equal(resolveChannel(null, null), "direct");
assert.equal(resolveChannel("", ""), "direct");
assert.equal(resolveChannel("newsletter", "google.com"), "newsletter", "utm beats referrer");
assert.equal(normalizeChannel("TikTok"), "tiktok");

// ---- server-side capture drops everything but the reduced fields ----
const fields = trafficFromRequest(
  { utmSource: "instagram", utmMedium: "social", referrer: "https://l.instagram.com/x?secret=1", landingPath: "/?email=a@b.c" },
  h({ "user-agent": IPHONE, "cf-ipcountry": "DE" })
);
assert.deepEqual(fields, { utm_source: "instagram", utm_medium: "social", utm_content: null, referrer_host: "l.instagram.com", landing_path: "/", device: "mobile", country: "DE" });
assert.equal(JSON.stringify(fields).includes("Mozilla"), false, "no UA stored");

// ---- period deltas ----
assert.deepEqual(periodDelta(12, 10), { abs: 2, pct: 20, dir: "up" });
assert.deepEqual(periodDelta(5, 10), { abs: -5, pct: -50, dir: "down" });
assert.deepEqual(periodDelta(3, 3), { abs: 0, pct: 0, dir: "flat" });
assert.deepEqual(periodDelta(4, 0), { abs: 4, pct: null, dir: "new" });
assert.deepEqual(periodDelta(0, 0), { abs: 0, pct: null, dir: "flat" });
assert.equal(periodDelta(4, null), null, "no previous period");
assert.equal(formatDelta(periodDelta(12, 10)), "+20%");
assert.equal(formatDelta(periodDelta(5, 10)), "−50%");
assert.equal(formatDelta(periodDelta(4, 0)), "+4 (new)");
assert.equal(formatDelta(null), "");
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([4, 1, 2, 3]), 2.5);
assert.equal(median([]), null);

// ---- model: exclusions, sessions, channels, paid linkage ----
const NOW = Date.parse("2026-11-03T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const ev = (sid: string, event: string, at: number, extra: Partial<TrafficEvent> = {}): TrafficEvent => ({
  created_at: iso(at), event, session_id: sid, variant: "noswipe", utm_campaign: null, dedupe_key: null, ...extra
});
const A = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // instagram, pays
const B = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // direct desktop
const C = "33333333-cccc-4ccc-8ccc-cccccccccccc"; // founder checkout: must be dropped
const D = "44444444-dddd-4ddd-8ddd-dddddddddddd"; // old row without traffic data
const PROBE = "00000000-eeee-4eee-8eee-eeeeeeeeeeee";
const t0 = NOW - 2 * HOUR;
const events: TrafficEvent[] = [
  ev(A, "page_view", t0, { utm_source: "ig", referrer_host: "l.instagram.com", landing_path: "/", device: "mobile", country: "US", ref: "DAbc123" }),
  ev(A, "get_started", t0 + 10_000, { utm_source: "ig", device: "mobile" }),
  ev(A, "reserve_start", t0 + 20_000, { device: "mobile" }),
  ev(A, "reserve_step_2", t0 + 30_000, { device: "mobile" }),
  ev(A, "reserve_step_3", t0 + 40_000, { device: "mobile" }),
  ev(A, "onboarding_complete", t0 + 50_000, { device: "mobile" }),
  ev(A, "checkout_created", t0 + 60_000, { dedupe_key: "checkout_created:cs_live_A" }),
  ev(A, "paid", t0 + 600_000, { dedupe_key: "paid:cs_live_A" }),
  ev(B, "page_view", t0 + HOUR / 2, { landing_path: "/guides/tinder-bio", device: "desktop" }),
  ev(C, "page_view", t0, { landing_path: "/", device: "desktop", utm_source: "instagram" }),
  ev(C, "checkout_created", t0 + 5_000, { dedupe_key: "checkout_created:cs_live_C" }),
  ev(PROBE, "page_view", t0, { landing_path: "/", device: "desktop" }),
  ev(D, "page_view", t0 + 1000)
];
const reservation = (over: Partial<ReservationRow>): ReservationRow => ({
  created_at: iso(t0 + 60_000), email: "guy@gmail.com", status: "pending", paid_at: null, stripe_checkout_session_id: null, variant: "noswipe", utm_campaign: null, ...over
});
const reservations: ReservationRow[] = [
  reservation({ stripe_checkout_session_id: "cs_live_A", status: "paid", paid_at: iso(t0 + 600_000) }),
  reservation({ stripe_checkout_session_id: "cs_live_C", email: "meyrlansuirkhanov@gmail.com", status: "paid", paid_at: iso(t0 + 9000) }),
  reservation({ stripe_checkout_session_id: "cs_test_Z", email: "x@y.com", status: "paid", paid_at: iso(t0 + 9000) }),
  reservation({ stripe_checkout_session_id: "cs_live_OLD", email: "old@y.com", status: "paid", paid_at: iso(t0 + 30_000) }) // never linked to a visit
];
const model = buildTrafficModel(events, reservations);
assert.equal(model.sessions.has(C), false, "founder checkout session dropped");
assert.equal(model.sessions.has(PROBE), false, "probe session dropped");
assert.equal(model.sessions.size, 3);
assert.equal(model.sessions.get(A)!.channel, "instagram");
assert.equal(model.sessions.get(B)!.channel, "direct");
assert.equal(model.sessions.get(D)!.channel, "(not captured)", "old rows are labelled honestly, not 'direct'");
assert.equal(model.captureSince, t0, "capture start = first event with traffic data");

const stats = periodStats(model, NOW - DAY, NOW + 1);
assert.deepEqual(stats.totals, { visitors: 3, getStarted: 1, opened: 1, step2: 1, step3: 1, done: 1, checkouts: 2, paid: 2 });
const row = (key: string) => stats.channels.find((r) => r.key === key)!;
assert.equal(row("instagram").paid, 1);
assert.equal(row("instagram").visitors, 1);
assert.equal(row("(not linked to a visit)").paid, 1, "unlinked paid reservation stays in the totals");
assert.equal(stats.devices.find((r) => r.key === "mobile")!.visitors, 1);
assert.equal(stats.landing.find((r) => r.key === "/guides/tinder-bio")!.visitors, 1);
assert.equal(stats.countries.find((r) => r.key === "US")!.visitors, 1);
assert.equal(stats.medianPaidSeconds, 600 - 0, "10 min from first visit to payment");
assert.equal(stats.paidSamples, 1);
assert.equal(stats.stacked.bucketMs, HOUR);
assert.equal(stats.stacked.values.flat().reduce((a, b) => a + b, 0), 3);
assert.ok(stats.capturedShare !== null && Math.abs(stats.capturedShare - 2 / 3) < 1e-9);

const prev = periodStats(model, NOW - 2 * DAY, NOW - DAY);
assert.equal(prev.totals.visitors, 0);
assert.deepEqual(periodDelta(stats.totals.visitors, prev.totals.visitors), { abs: 3, pct: null, dir: "new" });

const live = liveNow(model, t0 + 40 * 60_000);
assert.equal(live.sessions, 1, "only B (+30min) is within the last 30 minutes at t0+40min... A's last event is at t0+50s");
assert.equal(liveNow(model, NOW).sessions, 0);

// ---- the Overview funnel agrees with the old definition and supports a bounded previous window ----
const cur = computeRealFunnel(events, reservations, 1, new Date(NOW));
assert.equal(cur.visitors, 3);
assert.equal(cur.paid, 2);
const none = computeRealFunnel(events, reservations, 2, new Date(NOW), NOW - DAY);
assert.equal(none.visitors, 0, "previous window excludes today's events");
assert.equal(none.paid, 0);

// ---- alarms ----
const ok = { visitors: 100, paid: 4, prevVisitors: 100, prevPaid: 4 };
const ids = (a: ReturnType<typeof computeAlarms>) => a.filter((x) => x.level === "bad").map((x) => x.id);
assert.deepEqual(ids(computeAlarms({ visitors24h: 5, posts24h: 3, queueNext24h: 4, conv: ok })), []);
assert.deepEqual(ids(computeAlarms({ visitors24h: 0, posts24h: 0, queueNext24h: 0, conv: ok })), ["visitors", "posts", "queue"]);
assert.deepEqual(ids(computeAlarms({ visitors24h: 5, posts24h: 3, queueNext24h: 4, conv: { visitors: 100, paid: 1, prevVisitors: 100, prevPaid: 4 } })), ["conversion"], "75% drop");
assert.deepEqual(ids(computeAlarms({ visitors24h: 5, posts24h: 3, queueNext24h: 4, conv: { visitors: 100, paid: 3, prevVisitors: 100, prevPaid: 4 } })), [], "25% drop is not an alarm");
assert.deepEqual(ids(computeAlarms({ visitors24h: 5, posts24h: 3, queueNext24h: 4, conv: { visitors: 10, paid: 0, prevVisitors: 100, prevPaid: 4 } })), [], "too few visitors to judge");
assert.equal(computeAlarms({ visitors24h: 1, posts24h: null, queueNext24h: null, conv: ok }).filter((a) => a.level === "unknown").length, 2, "unreadable queue is 'unknown', not 0");

// ---- cadence helpers ----
const perDay = postsPerDay([iso(NOW - 1000), iso(NOW - 2000), iso(NOW - DAY * 3)], NOW, 14, "America/Los_Angeles");
assert.equal(perDay.length, 14);
assert.equal(perDay[13].count, 2);
assert.equal(perDay.reduce((a, d) => a + d.count, 0), 3);
assert.equal(shortcodeFromUrl("https://www.instagram.com/reel/DAbc123/"), "DAbc123");
assert.equal(shortcodeFromUrl("https://www.instagram.com/noswipe.app/reel/DAbc_1-2/?igsh=x"), "DAbc_1-2");
assert.equal(shortcodeFromUrl("https://example.com/x"), null);

// ---- content sync stays backward compatible ----
const basePost = {
  external_ref: "a".repeat(32), title: "t", caption: "", status: "posted", scheduled_at: null, posted_at: "2026-11-02T10:00:00Z",
  post_url: "https://www.instagram.com/reel/DAbc123/", submitted_by: null, source: "team", fixes: [], duration_s: null, created_at: "2026-11-01T10:00:00Z", preview: null
};
const old = syncRequestSchema.safeParse({ posts: [basePost], done: [] });
assert.ok(old.success, "old payload without metrics still parses");
assert.equal(old.success && old.data.posts[0].views, undefined);
const withMetrics = syncRequestSchema.safeParse({ posts: [{ ...basePost, views: 1200, likes: 40, comments: null, metrics_at: "2026-11-02T12:00:00Z" }], done: [] });
assert.ok(withMetrics.success && withMetrics.data.posts[0].views === 1200 && withMetrics.data.posts[0].comments === null);
assert.equal(syncRequestSchema.safeParse({ posts: [{ ...basePost, views: -1 }], done: [] }).success, false);
assert.equal(syncRequestSchema.safeParse({ posts: [{ ...basePost, views: 1.5 }], done: [] }).success, false);

console.log("admin analytics checks passed");
