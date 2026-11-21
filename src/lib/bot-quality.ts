// Visit quality: is this session a person, a probable crawler, or a clear bot?
// Pure, no I/O, no "server-only": used by /api/event (per request), by the admin reports (per session)
// and by scripts/backfill-session-quality.ts (stored rows). One definition so all three agree.
//
// Two layers:
//  1. Request signals (classifyRequest): the User-Agent, Accept-Language, and the network the
//     request came from. Decided once, when the event arrives, and stored on funnel_events.quality.
//     "bot" is certain enough to also store device = 'bot' (which every report already drops).
//     "suspect" is a doubt, not a verdict: it stays in the table and an admin toggle brings it back.
//  2. Behaviour (classifySession): a visit that has exactly one page_view, nothing else and no dwell
//     is "unengaged". It cannot be known at insert time, so it is derived when the numbers are read.
//
// Privacy: the UA, IP and ASN are read and reduced to a label; none of them is stored or logged.

export const QUALITIES = ["human", "suspect", "bot"] as const;
export type Quality = (typeof QUALITIES)[number];

export const isQuality = (value: unknown): value is Quality => typeof value === "string" && (QUALITIES as readonly string[]).includes(value);

const RANK: Record<Quality, number> = { human: 0, suspect: 1, bot: 2 };
export const worstQuality = (a: Quality, b: Quality): Quality => (RANK[a] >= RANK[b] ? a : b);

// ---------- User-Agent ----------

// Headless / automation frameworks, uptime and SEO tools, link-preview and security scanners, HTTP libraries.
// `(?<!cu)bot` keeps the Cubot phone brand human. Real mobile Safari / Chrome / in-app browser UAs match none of this.
const AUTOMATION_UA = /headless|lighthouse|\bptst\b|puppeteer|playwright|phantomjs|selenium|webdriver|gtmetrix|pagespeed|chrome-lighthouse|prerender|inspectiontool/i;
const CRAWLER_UA = /(?<!cu)bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebot|ahrefs|semrush|mj12|dataprovider|pingdom|uptime|monitor|preview|\bscan(ner|ning)?\b|httrack|scrapy/i;
const HTTP_CLIENT_UA = /python|curl\/|wget\/|libwww|httpclient|java\/|go-http|node-fetch|undici|axios|okhttp\/|\bgot\b\/|aiohttp|reqwest/i;

/** Why a User-Agent is a bot, or null when it looks like a browser. */
export function botUserAgentReason(userAgent: string | null | undefined): "automation" | "crawler" | "http_client" | null {
  const ua = (userAgent ?? "").trim();
  if (!ua) return null;
  if (AUTOMATION_UA.test(ua)) return "automation";
  if (CRAWLER_UA.test(ua)) return "crawler";
  if (HTTP_CLIENT_UA.test(ua)) return "http_client";
  return null;
}

export const isBotUserAgent = (userAgent: string | null | undefined) => botUserAgentReason(userAgent) !== null;

// ---------- Datacenter networks ----------

/**
 * Autonomous systems that are cloud / hosting providers: a person browsing from one of these is rare, a
 * script is common. Small on purpose; add an ASN here when a crawler shows up from one (and a test line).
 * Vercel does not document an AS-number header; `x-vercel-ip-as-number` / `cf-connecting-asn`-style values are
 * read when a proxy sends them, and the list does nothing when none arrives.
 */
export const CLOUD_ASNS: ReadonlyMap<number, string> = new Map([
  [37963, "Alibaba Cloud"], [45102, "Alibaba Cloud"],
  [45090, "Tencent Cloud"], [132203, "Tencent Cloud"],
  [55990, "Huawei Cloud"], [136907, "Huawei Cloud"],
  [55967, "Baidu Cloud"],
  [16509, "AWS"], [14618, "AWS"],
  [396982, "Google Cloud"], [15169, "Google"],
  [8075, "Microsoft Azure"],
  [14061, "DigitalOcean"],
  [16276, "OVH"],
  [24940, "Hetzner"],
  [63949, "Linode"], [20473, "Vultr"], [31898, "Oracle Cloud"]
]);

/** "AS16509", "16509" or " as 16509 " to 16509. null for anything else. */
export function parseAsn(raw: string | null | undefined): number | null {
  const m = /^\s*(?:as)?\s*(\d{1,10})\s*$/i.exec(raw ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function cloudProviderFromHeaders(headers: { get(name: string): string | null }): string | null {
  const asn = parseAsn(headers.get("x-vercel-ip-as-number") ?? headers.get("x-asn") ?? headers.get("cf-connecting-asn"));
  return asn === null ? null : (CLOUD_ASNS.get(asn) ?? null);
}

// ---------- Request ----------

export type RequestQuality = { quality: Quality; reasons: string[] };

/** Vercel's traffic-source classification (Priority projects only): tor / vpn / proxy / res-proxy / abuse. A plain VPN is not suspicious. */
function wafSourceSuspect(headers: { get(name: string): string | null }): boolean {
  const raw = headers.get("x-vercel-waf-source");
  return !!raw && raw.split(",").some((v) => ["tor", "proxy", "res-proxy", "abuse"].includes(v.trim().toLowerCase()));
}

/** What the request itself says. `reasons` are short machine labels for the admin and the backfill report. */
export function classifyRequest(headers: { get(name: string): string | null }): RequestQuality {
  const reasons: string[] = [];
  const ua = (headers.get("user-agent") ?? "").trim();
  const uaReason = botUserAgentReason(ua);
  if (!ua) reasons.push("no_user_agent");
  if (uaReason) reasons.push(`ua_${uaReason}`);

  const noLanguage = !(headers.get("accept-language") ?? "").trim();
  if (noLanguage) reasons.push("no_accept_language");
  const cloud = cloudProviderFromHeaders(headers);
  if (cloud) reasons.push("datacenter_asn");
  if (wafSourceSuspect(headers)) reasons.push("anonymizing_network");

  // Clear bots: the UA says so, there is no UA at all, or a hosting network that also hides its language.
  if (uaReason || !ua || (cloud && noLanguage)) return { quality: "bot", reasons };
  if (noLanguage || cloud || reasons.includes("anonymizing_network")) return { quality: "suspect", reasons };
  return { quality: "human", reasons };
}

// ---------- Session ----------

/** A single page_view with nothing else and less than this between first and last event is "unengaged". */
export const UNENGAGED_DWELL_MS = 2_000;
/** A visit this young may still be about to do something: never called unengaged yet. */
export const UNENGAGED_GRACE_MS = 30 * 60_000;

export type QualityEvent = {
  created_at: string;
  event: string;
  session_id: string | null;
  device?: string | null;
  quality?: string | null;
  utm_source?: string | null;
  referrer_host?: string | null;
  in_app_source?: string | null;
  landing_path?: string | null;
  country?: string | null;
};

export type SessionQuality = { quality: Quality; reasons: string[]; firstAt: number };

const REACHED_PAID = new Set(["paid"]);

/**
 * Quality of every session in `events`. Worst stored label wins; device 'bot' counts as bot; then the
 * behavioural rule. Rows from before the quality column (quality null) are "legacy": treated as human unless
 * the device says bot or the behaviour does. A session that PAID is never downgraded to
 * suspect (money is never hidden by a doubt); only a certain bot is dropped. An unpaid checkout from a suspect session is filtered.
 */
export function sessionQualities(events: readonly QualityEvent[], nowMs: number): Map<string, SessionQuality> {
  type Acc = { first: number; last: number; n: number; pageViews: number; checkout: boolean; captured: boolean; sourced: boolean; stored: Quality; deviceBot: boolean; storedBot: boolean };
  const acc = new Map<string, Acc>();
  for (const e of events) {
    if (!e.session_id) continue;
    const at = Date.parse(e.created_at);
    if (Number.isNaN(at)) continue;
    let a = acc.get(e.session_id);
    if (!a) { a = { first: at, last: at, n: 0, pageViews: 0, checkout: false, captured: false, sourced: false, stored: "human", deviceBot: false, storedBot: false }; acc.set(e.session_id, a); }
    a.first = Math.min(a.first, at);
    a.last = Math.max(a.last, at);
    a.n += 1;
    if (e.event === "page_view") a.pageViews += 1;
    if (REACHED_PAID.has(e.event)) a.checkout = true;
    if (e.device || e.in_app_source || e.utm_source || e.referrer_host || e.landing_path || e.country) a.captured = true;
    if (e.in_app_source || e.utm_source || e.referrer_host) a.sourced = true;
    if (e.device === "bot") a.deviceBot = true;
    if (isQuality(e.quality)) {
      a.stored = worstQuality(a.stored, e.quality);
      if (e.quality === "bot") a.storedBot = true;
    }
  }
  const out = new Map<string, SessionQuality>();
  for (const [id, a] of acc) {
    const reasons: string[] = [];
    let quality: Quality = "human";
    if (a.deviceBot || a.storedBot) { quality = "bot"; reasons.push(a.deviceBot ? "device_bot" : "stored_bot"); }
    else if (a.stored === "suspect") { quality = "suspect"; reasons.push("stored_suspect"); }
    if (quality !== "bot" && a.captured && !a.sourced && a.pageViews === 1 && a.n === 1 && a.last - a.first < UNENGAGED_DWELL_MS && nowMs - a.last > UNENGAGED_GRACE_MS) {
      quality = worstQuality(quality, "suspect");
      reasons.push("unengaged_direct");
    }
    if (quality === "suspect" && a.checkout) { quality = "human"; reasons.push("paid"); }
    out.set(id, { quality, reasons, firstAt: a.first });
  }
  return out;
}

export type QualityFilter = { includeSuspect: boolean };

/** Whether a session with this quality is counted. Bots never are. */
export const counts = (q: Quality | undefined, filter: QualityFilter): boolean => q === undefined || q === "human" || (q === "suspect" && filter.includeSuspect);

export type FilteredSessions = { bot: number; suspect: number; reasons: Record<string, number> };

/** How many sessions were left out and why (for the admin note). `inRange` limits it to a window. */
export function summariseFiltered(qualities: ReadonlyMap<string, SessionQuality>, filter: QualityFilter, inRange: (firstAt: number) => boolean = () => true): FilteredSessions {
  const out: FilteredSessions = { bot: 0, suspect: 0, reasons: {} };
  for (const q of qualities.values()) {
    if (q.quality === "human" || !inRange(q.firstAt)) continue;
    if (q.quality === "suspect" && filter.includeSuspect) continue;
    out[q.quality] += 1;
    for (const r of q.reasons) out.reasons[r] = (out.reasons[r] ?? 0) + 1;
  }
  return out;
}

const REASON_LABELS: Record<string, string> = {
  device_bot: "crawler or automation user agent",
  stored_bot: "crawler or automation user agent",
  stored_suspect: "no browser language or a datacenter / anonymizing network",
  unengaged_direct: "one page view, no source, no interaction"
};

/** "3 likely bots (crawler or automation user agent: 3), 5 suspect sessions (...)": the sentence the admin shows. null when nothing was filtered. */
export function describeFiltered(f: FilteredSessions): string | null {
  if (f.bot + f.suspect === 0) return null;
  const parts: string[] = [];
  const counts = new Map<string, number>();
  for (const [reason, n] of Object.entries(f.reasons)) {
    if (reason === "paid") continue;
    const label = REASON_LABELS[reason] ?? reason;
    counts.set(label, (counts.get(label) ?? 0) + n);
  }
  const why = [...counts].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${label}: ${n}`).join("; ");
  if (f.bot) parts.push(`${f.bot} bot ${f.bot === 1 ? "session" : "sessions"}`);
  if (f.suspect) parts.push(`${f.suspect} suspect ${f.suspect === 1 ? "session" : "sessions"}`);
  return `${parts.join(" and ")} left out${why ? ` (${why})` : ""}.`;
}

// ---------- Backfill ----------

export type BackfillPlan = {
  sessions: number;
  byQuality: Record<Quality, number>;
  reasons: Record<string, number>;
  /** Sessions to write: only those that are not human, and whose stored label is missing or lower. Human rows stay NULL (legacy). */
  updates: { sessionId: string; quality: "suspect" | "bot" }[];
  /** Page-view sessions counted before (device bot dropped, nothing else) and after (humans only). */
  pageViewSessions: { before: number; after: number };
  /** Non-human sessions per country (2-letter or "unknown"), for the report. */
  countries: Record<string, { suspect: number; bot: number }>;
};

/** Reclassifies stored events (country, device, referrer, event counts per session, stored quality). Pure: the script does the I/O. */
export function planBackfill(events: readonly QualityEvent[], nowMs: number): BackfillPlan {
  const qualities = sessionQualities(events, nowMs);
  const storedBy = new Map<string, Quality>();
  const country = new Map<string, string>();
  const pageView = new Set<string>();
  const deviceBot = new Set<string>();
  for (const e of events) {
    if (!e.session_id) continue;
    if (isQuality(e.quality)) storedBy.set(e.session_id, worstQuality(storedBy.get(e.session_id) ?? "human", e.quality));
    if (e.country && !country.has(e.session_id)) country.set(e.session_id, e.country);
    if (e.event === "page_view") pageView.add(e.session_id);
    if (e.device === "bot") deviceBot.add(e.session_id);
  }
  const plan: BackfillPlan = { sessions: qualities.size, byQuality: { human: 0, suspect: 0, bot: 0 }, reasons: {}, updates: [], pageViewSessions: { before: 0, after: 0 }, countries: {} };
  for (const [id, q] of qualities) {
    plan.byQuality[q.quality] += 1;
    if (pageView.has(id)) {
      if (!deviceBot.has(id)) plan.pageViewSessions.before += 1;
      if (q.quality === "human") plan.pageViewSessions.after += 1;
    }
    if (q.quality === "human") continue;
    for (const r of q.reasons) plan.reasons[r] = (plan.reasons[r] ?? 0) + 1;
    const c = country.get(id) ?? "unknown";
    (plan.countries[c] ??= { suspect: 0, bot: 0 })[q.quality] += 1;
    if (RANK[storedBy.get(id) ?? "human"] < RANK[q.quality]) plan.updates.push({ sessionId: id, quality: q.quality });
  }
  return plan;
}
