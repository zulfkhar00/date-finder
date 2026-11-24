import assert from "node:assert/strict";
import { decideHero, heroLabel, isHeroLabel } from "../src/lib/hero-experiment";
import { heroExperiment, heroVerdict, twoProportionP, HERO_MIN_PER_ARM } from "../src/lib/hero-report";
import { buildTrafficModel, type TrafficEvent } from "../src/lib/traffic-report";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// ---- assignment: sticky, 50/50, bots and QA excluded ----
assert.deepEqual(decideHero({ userAgent: CHROME, cookie: undefined, queryV: null, random: 0.2 }), { variant: "a", setCookie: true, forced: false });
assert.deepEqual(decideHero({ userAgent: CHROME, cookie: undefined, queryV: null, random: 0.7 }), { variant: "b", setCookie: true, forced: false });
assert.deepEqual(decideHero({ userAgent: CHROME, cookie: "b", queryV: null, random: 0.1 }), { variant: "b", setCookie: false, forced: false }, "an existing cookie is never re-rolled");
assert.equal(decideHero({ userAgent: CHROME, cookie: "junk", queryV: null, random: 0.9 }).variant, "b", "a bad cookie is re-assigned");
for (const bot of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 HeadlessChrome/126.0", "curl/8.4.0", null]) {
  const d = decideHero({ userAgent: bot, cookie: undefined, queryV: null, random: 0.9 });
  assert.deepEqual(d, { variant: "a", setCookie: false, forced: false }, `bot gets A and no cookie: ${bot}`);
}
assert.deepEqual(decideHero({ userAgent: CHROME, cookie: "a", queryV: "b", random: 0.1 }), { variant: "b", setCookie: false, forced: true }, "?v=b forces B without touching the cookie");
assert.equal(decideHero({ userAgent: CHROME, cookie: undefined, queryV: "men", random: 0.1 }).forced, false, "a campaign v value is not a preview");
// 50/50 over a uniform sweep
let b = 0;
for (let i = 0; i < 1000; i++) if (decideHero({ userAgent: CHROME, cookie: undefined, queryV: null, random: i / 1000 }).variant === "b") b += 1;
assert.equal(b, 500);
assert.equal(decideHero({ userAgent: IPHONE, cookie: undefined, queryV: null, random: 0.3 }).setCookie, true, "phones are in the test");
assert.equal(heroLabel("a"), "hero-a");
assert.equal(heroLabel("x"), null);
assert.ok(isHeroLabel("hero-b") && !isHeroLabel("noswipe"));

// ---- statistics ----
const p = twoProportionP(100, 500, 100, 500);
assert.ok(p !== null && Math.abs(p - 1) < 1e-6, "equal rates -> p = 1");
const sig = twoProportionP(85, 500, 125, 500);
assert.ok(sig !== null && sig < 0.01, "17% vs 25% on 500 each is significant");
const known = twoProportionP(50, 100, 50 + 0, 100);
assert.ok(known !== null && known > 0.99);
// z = 1.96 gives p ~ 0.05 (n large, rates 0.4 vs 0.4 + 1.96*se)
const n = 10000;
const se = Math.sqrt(2 * 0.4 * 0.6 / n);
const edge = twoProportionP(0.4 * n, n, Math.round((0.4 + 1.96 * se) * n), n);
assert.ok(edge !== null && Math.abs(edge - 0.05) < 0.005, `edge p ${edge}`);
assert.equal(twoProportionP(0, 0, 5, 10), null);
const arm = (sessions: number, started: number) => ({ sessions, getStarted: started, started, basics: 0, signedIn: 0, done: 0, checkouts: 0, paid: 0 });
assert.equal(heroVerdict(arm(HERO_MIN_PER_ARM - 1, 10), arm(HERO_MIN_PER_ARM + 50, 90)).verdict.kind, "collecting", "never called below the minimum, even with a huge gap");
assert.deepEqual(heroVerdict(arm(400, 68), arm(400, 100)).verdict.kind, "winner");
assert.equal(heroVerdict(arm(400, 68), arm(400, 72)).verdict.kind, "none");
const win = heroVerdict(arm(400, 100), arm(400, 68)).verdict;
assert.ok(win.kind === "winner" && win.winner === "a");

// ---- report: only landed-on-home, hero-tagged, real sessions; split by device and variant ----
const at = (m: number) => new Date(Date.UTC(2026, 10, 23, 12, m)).toISOString();
let id = 0;
const sid = () => `1111111${(id++).toString().padStart(1, "0")}-1111-4111-8111-111111111111`.slice(0, 36);
const events: TrafficEvent[] = [];
function session(opts: { variant: string; device: "desktop" | "mobile"; landing?: string; steps: string[]; minute: number; probe?: boolean }) {
  const s = opts.probe ? `00000000-0000-4000-8000-00000000000${id++}` : sid();
  opts.steps.forEach((event, i) => events.push({ created_at: at(opts.minute + i), event, session_id: s, variant: opts.variant, utm_campaign: null, dedupe_key: null, device: opts.device, utm_source: "instagram", landing_path: opts.landing ?? "/", quality: "human" }));
  return s;
}
const full = ["page_view", "get_started", "reserve_start", "reserve_step_2", "reserve_step_3", "onboarding_complete"];
session({ variant: "hero-a", device: "desktop", steps: ["page_view"], minute: 0 });
session({ variant: "hero-a", device: "desktop", steps: ["page_view", "get_started", "reserve_start"], minute: 5 });
session({ variant: "hero-b", device: "desktop", steps: full, minute: 10 });
session({ variant: "hero-b", device: "mobile", steps: ["page_view", "get_started", "reserve_start", "reserve_step_2"], minute: 15 });
session({ variant: "hero-b", device: "mobile", steps: ["page_view"], minute: 20 });
session({ variant: "hero-a", device: "mobile", steps: ["page_view"], minute: 25 });
session({ variant: "hero-b", device: "desktop", landing: "/tinder-automation", steps: ["page_view", "reserve_start"], minute: 30 }); // not the home hero
session({ variant: "noswipe", device: "desktop", steps: ["page_view", "reserve_start"], minute: 35 }); // not in the test
session({ variant: "hero-b", device: "desktop", steps: full, minute: 40, probe: true }); // QA / founder probe
// Checkout + paid for the full desktop B session
const bDesktopFull = events.find((e) => e.variant === "hero-b" && e.event === "onboarding_complete" && e.device === "desktop" && !e.session_id!.startsWith("00000000"))!.session_id!;
events.push({ created_at: at(50), event: "checkout_created", session_id: bDesktopFull, variant: "hero-b", utm_campaign: null, dedupe_key: "checkout_created:cs_live_1", device: "desktop" });
const reservations = [{ id: "r1", created_at: at(51), email: "jordan.rivera@outlook.com", status: "paid", paid_at: at(52), stripe_checkout_session_id: "cs_live_1", variant: "hero-b", utm_campaign: null }];

const model = buildTrafficModel(events, reservations as never, new Map(), { nowMs: Date.UTC(2026, 10, 23, 13) });
const rows = heroExperiment(model, Date.UTC(2026, 10, 23), Date.UTC(2026, 10, 24));
const by = Object.fromEntries(rows.map((r) => [r.segment, r]));
assert.equal(by.all.a.sessions, 3);
assert.equal(by.all.b.sessions, 3, "non-home landing, other variants and probes are out");
assert.equal(by.desktop.a.sessions, 2);
assert.equal(by.desktop.a.started, 1);
assert.equal(by.desktop.b.sessions, 1);
assert.equal(by.desktop.b.done, 1);
assert.equal(by.desktop.b.checkouts, 1);
assert.equal(by.desktop.b.paid, 1);
assert.equal(by.mobile.b.sessions, 2);
assert.equal(by.mobile.b.basics, 1);
assert.equal(by.mobile.a.sessions, 1);
assert.equal(by.all.a.paid, 0);
assert.equal(by.all.b.paid, 1);
assert.equal(by.all.a.getStarted, 1);
assert.equal(by.all.verdict.kind, "collecting");

console.log("hero experiment ok");
