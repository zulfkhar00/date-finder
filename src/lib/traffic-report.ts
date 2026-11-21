// Pure traffic analytics for /admin/traffic, the Overview and /admin/videos. Takes rows already
// fetched (see src/app/admin/_lib/traffic-data.ts) and returns numbers; no I/O.
//
// Same exclusions as the Overview: founder / test-email / Stripe-test reservations and every
// funnel session tied to them, plus our own probe sessions (internalSessionIds in real-funnel).
// Importing real-funnel pulls in "server-only", so run the tests with --conditions=react-server.

import { CHECKOUT_DIAGNOSTIC_EVENTS } from "@/lib/checkout-events";
import { internalSessionIds, splitReservations, type ReservationRow } from "@/lib/real-funnel";
import { DIRECT_CHANNEL, NOT_CAPTURED_CHANNEL, resolveChannel, normalizeChannel } from "@/lib/traffic";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const LIVE_WINDOW_MS = 30 * MIN;
export const UNLINKED = "(not linked to a visit)";

export type TrafficEvent = {
  created_at: string;
  event: string;
  session_id: string | null;
  variant: string | null;
  utm_campaign: string | null;
  dedupe_key: string | null;
  ref?: string | null;
  user_id?: string | null;
  account_internal?: boolean | null;
  in_app_source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  referrer_host?: string | null;
  landing_path?: string | null;
  device?: string | null;
  country?: string | null;
};

export type Session = {
  id: string;
  firstAt: number;
  lastAt: number;
  captured: boolean;
  channel: string;
  /** Raw referrer host of the visit (not folded into a channel), for the top-referrers table. */
  refHost: string | null;
  landing: string | null;
  device: string | null;
  country: string | null;
  ref: string | null;
  pageView: boolean;
  getStarted: boolean;
  opened: boolean;
  step2: boolean;
  step3: boolean;
  done: boolean;
};

export type TrafficModel = {
  sessions: Map<string, Session>;
  /** Real reservations (exclusions applied). */
  reservations: ReservationRow[];
  stripeToSession: Map<string, string>;
  /** Earliest event that carries any traffic column, ms; null when nothing has been captured yet. */
  captureSince: number | null;
  /** Stripe Checkout Session id -> first-touch source stored on the reservation (empty before the first-touch migration). */
  firstTouchByStripe: Map<string, string>;
};

const SERVER_EVENTS = new Set(["checkout_created", "paid", ...CHECKOUT_DIAGNOSTIC_EVENTS]);

/** Groups raw events into one record per visit (tab session) and drops internal / test traffic. */
export function buildTrafficModel(events: TrafficEvent[], allReservations: ReservationRow[], firstTouchByStripe: Map<string, string> = new Map(), internalUserIds: ReadonlySet<string> = new Set()): TrafficModel {
  const { real, badStripeSessions } = splitReservations(allReservations, null, null);
  const internal = internalSessionIds(events, badStripeSessions, internalUserIds);
  const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  const stripeToSession = new Map<string, string>();
  const sessions = new Map<string, Session>();
  const raw = new Map<string, { utm: string | null; ref: string | null; app: string | null }>();
  let captureSince: number | null = null;

  for (const e of sorted) {
    const at = Date.parse(e.created_at);
    if (Number.isNaN(at)) continue;
    const hasTraffic = Boolean(e.device || e.in_app_source || e.utm_source || e.referrer_host || e.landing_path || e.country);
    if (hasTraffic && (captureSince === null || at < captureSince)) captureSince = at;
    if (!e.session_id || internal.has(e.session_id)) continue;
    if (SERVER_EVENTS.has(e.event)) {
      if (e.event === "checkout_created" && e.dedupe_key) stripeToSession.set(e.dedupe_key.slice(e.dedupe_key.indexOf(":") + 1), e.session_id);
      continue; // reservations are the source of truth for checkout and paid
    }
    let s = sessions.get(e.session_id);
    if (!s) {
      s = { id: e.session_id, firstAt: at, lastAt: at, captured: false, channel: NOT_CAPTURED_CHANNEL, refHost: null, landing: null, device: null, country: null, ref: null, pageView: false, getStarted: false, opened: false, step2: false, step3: false, done: false };
      sessions.set(e.session_id, s);
      raw.set(e.session_id, { utm: null, ref: null, app: null });
    }
    const r = raw.get(e.session_id)!;
    s.lastAt = Math.max(s.lastAt, at);
    if (hasTraffic) s.captured = true;
    r.utm ??= e.utm_source?.trim() || null;
    r.ref ??= e.referrer_host?.trim() || null;
    r.app ??= e.in_app_source?.trim() || null;
    s.landing ??= e.landing_path ?? null;
    s.device ??= e.device ?? null;
    s.country ??= e.country ?? null;
    s.ref ??= e.ref ?? null;
    if (e.event === "page_view") s.pageView = true;
    else if (e.event === "get_started") s.getStarted = true;
    else if (e.event === "reserve_start") s.opened = true;
    else if (e.event === "reserve_step_2") s.step2 = true;
    else if (e.event === "reserve_step_3") s.step3 = true;
    else if (e.event === "onboarding_complete") s.done = true;
  }
  for (const s of sessions.values()) {
    // Crawlers that run JS (Lighthouse, site audits) are not visitors.
    if (s.device === "bot") { sessions.delete(s.id); continue; }
    const r = raw.get(s.id)!;
    s.refHost = r.ref;
    if (s.captured) s.channel = resolveChannel(r.utm, r.ref, r.app);
  }
  return { sessions, reservations: real, stripeToSession, captureSince, firstTouchByStripe };
}

// ---------- Periods ----------

export type Totals = { visitors: number; getStarted: number; opened: number; step2: number; step3: number; done: number; checkouts: number; paid: number };
export type DimRow = Totals & { key: string };
export const EMPTY_TOTALS: Totals = { visitors: 0, getStarted: 0, opened: 0, step2: 0, step3: 0, done: 0, checkouts: 0, paid: 0 };

export type StackedSeries = { buckets: number[]; bucketMs: number; channels: string[]; values: number[][] };

export type PeriodStats = {
  fromMs: number;
  toMs: number;
  totals: Totals;
  channels: DimRow[];
  landing: DimRow[];
  devices: DimRow[];
  countries: DimRow[];
  /** External referrer hosts of this period's visitors (raw hosts, e.g. l.instagram.com), most visitors first. */
  referrerHosts: { key: string; visitors: number }[];
  /** Checkouts and paid by the FIRST touch stored on the reservation (not this visit's source). */
  firstTouch: { key: string; checkouts: number; paid: number }[];
  stacked: StackedSeries;
  /** Median seconds from first visit to payment, over paid reservations linked to a visit. null = no sample. */
  medianPaidSeconds: number | null;
  paidSamples: number;
  /** Share of this period's visitors recorded after traffic capture started (0..1). */
  capturedShare: number | null;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Dim = "channel" | "landing" | "device" | "country";
const DIM_LABEL = (s: Session, dim: Dim): string => {
  if (dim === "channel") return s.channel;
  const v = dim === "landing" ? s.landing : dim === "device" ? s.device : s.country;
  return v ?? (s.captured ? "(unknown)" : NOT_CAPTURED_CHANNEL);
};

export function periodStats(model: TrafficModel, fromMs: number, toMs: number, topChannels = 5): PeriodStats {
  const inRange = (ms: number) => ms >= fromMs && ms < toMs;
  const totals: Totals = { ...EMPTY_TOTALS };
  const tables: Record<Dim, Map<string, DimRow>> = { channel: new Map(), landing: new Map(), device: new Map(), country: new Map() };
  const row = (dim: Dim, key: string) => {
    let r = tables[dim].get(key);
    if (!r) { r = { key, ...EMPTY_TOTALS }; tables[dim].set(key, r); }
    return r;
  };
  const bump = (s: Session | null, field: keyof Totals) => {
    totals[field] += 1;
    for (const dim of ["channel", "landing", "device", "country"] as const) row(dim, s ? DIM_LABEL(s, dim) : UNLINKED)[field] += 1;
  };

  let capturedVisitors = 0;
  const hosts = new Map<string, number>();
  const firstTouch = new Map<string, { key: string; checkouts: number; paid: number }>();
  const ftRow = (key: string) => { let r = firstTouch.get(key); if (!r) { r = { key, checkouts: 0, paid: 0 }; firstTouch.set(key, r); } return r; };
  const visitorSessions: Session[] = [];
  for (const s of model.sessions.values()) {
    if (!inRange(s.firstAt)) continue;
    if (s.pageView) {
      bump(s, "visitors"); visitorSessions.push(s); if (s.captured) capturedVisitors += 1;
      if (s.refHost) hosts.set(s.refHost, (hosts.get(s.refHost) ?? 0) + 1);
    }
    if (s.getStarted) bump(s, "getStarted");
    if (s.opened) bump(s, "opened");
    if (s.step2) bump(s, "step2");
    if (s.step3) bump(s, "step3");
    if (s.done) bump(s, "done");
  }

  const paidDurations: number[] = [];
  for (const r of model.reservations) {
    const sid = r.stripe_checkout_session_id ? model.stripeToSession.get(r.stripe_checkout_session_id) : undefined;
    const s = sid ? model.sessions.get(sid) ?? null : null;
    const ft = r.stripe_checkout_session_id ? model.firstTouchByStripe.get(r.stripe_checkout_session_id) : undefined;
    if (inRange(Date.parse(r.created_at))) { bump(s, "checkouts"); if (ft) ftRow(ft).checkouts += 1; }
    if (r.status === "paid" && r.paid_at && inRange(Date.parse(r.paid_at))) {
      bump(s, "paid");
      if (ft) ftRow(ft).paid += 1;
      if (s) {
        const secs = (Date.parse(r.paid_at) - s.firstAt) / 1000;
        if (secs >= 0) paidDurations.push(secs);
      }
    }
  }

  const finish = (dim: Dim) =>
    [...tables[dim].values()].sort((a, b) => b.visitors - a.visitors || b.paid - a.paid || b.checkouts - a.checkouts || a.key.localeCompare(b.key));

  // Stacked series: hourly up to 48 h, daily beyond. Buckets are aligned to UTC.
  const bucketMs = toMs - fromMs <= 48 * HOUR ? HOUR : DAY;
  // Charts stay readable: at most the last 90 days of buckets (totals still cover the whole range).
  const first = Math.max(Math.floor(fromMs / bucketMs) * bucketMs, Math.floor((toMs - 90 * DAY) / bucketMs) * bucketMs);
  const buckets: number[] = [];
  for (let t = first; t < toMs; t += bucketMs) buckets.push(t);
  const channelOrder = finish("channel").filter((r) => r.visitors > 0).map((r) => r.key);
  const top = channelOrder.slice(0, topChannels);
  const names = channelOrder.length > topChannels ? [...top, "other"] : top;
  const values = names.map(() => buckets.map(() => 0));
  for (const s of visitorSessions) {
    const b = Math.floor((s.firstAt - first) / bucketMs);
    if (b < 0 || b >= buckets.length) continue; // older than the charted window
    const i = top.indexOf(s.channel);
    values[i === -1 ? names.length - 1 : i][b] += 1;
  }

  return {
    fromMs, toMs, totals,
    channels: finish("channel"), landing: finish("landing"), devices: finish("device"), countries: finish("country"),
    referrerHosts: [...hosts].map(([key, visitors]) => ({ key, visitors })).sort((a, b) => b.visitors - a.visitors || a.key.localeCompare(b.key)),
    firstTouch: [...firstTouch.values()].sort((a, b) => b.paid - a.paid || b.checkouts - a.checkouts || a.key.localeCompare(b.key)),
    stacked: { buckets, bucketMs, channels: names, values },
    medianPaidSeconds: median(paidDurations),
    paidSamples: paidDurations.length,
    capturedShare: visitorSessions.length ? capturedVisitors / visitorSessions.length : null
  };
}

export type LiveNow = { sessions: number; byChannel: { key: string; count: number }[]; byLanding: { key: string; count: number }[] };

/** Visits with any event in the last 30 minutes. */
export function liveNow(model: TrafficModel, nowMs: number): LiveNow {
  const channel = new Map<string, number>();
  const landing = new Map<string, number>();
  let sessions = 0;
  for (const s of model.sessions.values()) {
    if (s.lastAt < nowMs - LIVE_WINDOW_MS || s.lastAt > nowMs) continue;
    sessions += 1;
    channel.set(s.channel, (channel.get(s.channel) ?? 0) + 1);
    const l = s.landing ?? "(unknown)";
    landing.set(l, (landing.get(l) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 4);
  return { sessions, byChannel: top(channel), byLanding: top(landing) };
}

// ---------- Ranges and deltas ----------

export const RANGE_MS = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY } as const;
export type RangeKey = keyof typeof RANGE_MS | "all";

/** Current window and the equally long window before it. "all" has no comparison. Window ends at `nowMs`. */
export function rangeWindows(range: RangeKey, nowMs: number, earliestMs: number | null): { from: number; to: number; prevFrom: number | null; prevTo: number | null } {
  const to = nowMs + 1; // include events stamped this very millisecond
  if (range === "all") {
    const from = earliestMs === null ? nowMs - 30 * DAY : earliestMs;
    return { from, to, prevFrom: null, prevTo: null };
  }
  const len = RANGE_MS[range];
  return { from: nowMs - len, to, prevFrom: nowMs - 2 * len, prevTo: nowMs - len };
}

export type Delta = { abs: number; pct: number | null; dir: "up" | "down" | "flat" | "new" };

/** Change of a count (or rate) against the previous period. pct is null when there was nothing before. */
export function periodDelta(current: number, previous: number | null | undefined): Delta | null {
  if (previous === null || previous === undefined) return null;
  const abs = current - previous;
  if (abs === 0) return { abs: 0, pct: previous === 0 ? null : 0, dir: "flat" };
  if (previous === 0) return { abs, pct: null, dir: "new" };
  return { abs, pct: (abs / previous) * 100, dir: abs > 0 ? "up" : "down" };
}

export function formatDelta(delta: Delta | null, unit = ""): string {
  if (!delta) return "";
  if (delta.dir === "flat") return "no change";
  if (delta.dir === "new") return `+${trim(delta.abs)}${unit} (new)`;
  const sign = delta.abs > 0 ? "+" : "−";
  return `${sign}${Math.abs(Math.round(delta.pct ?? 0))}%`;
}
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function conversion(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

// ---------- Alarms ----------

export type Alarm = { id: string; level: "bad" | "ok" | "unknown"; title: string; detail: string };

export type AlarmInput = {
  visitors24h: number;
  /** null = posting queue table could not be read. */
  posts24h: number | null;
  queueNext24h: number | null;
  /** Last 7 days vs the 7 before. */
  conv: { visitors: number; paid: number; prevVisitors: number; prevPaid: number };
};

export const MIN_VISITORS_FOR_CONVERSION_ALARM = 20;

export function computeAlarms(input: AlarmInput): Alarm[] {
  const out: Alarm[] = [];
  out.push(input.visitors24h === 0
    ? { id: "visitors", level: "bad", title: "0 visitors in 24 h", detail: "No real visit recorded in the last 24 hours." }
    : { id: "visitors", level: "ok", title: `${input.visitors24h} visitors in 24 h`, detail: "Traffic is arriving." });

  if (input.posts24h === null) out.push({ id: "posts", level: "unknown", title: "Posts: unknown", detail: "Could not read the posting queue." });
  else out.push(input.posts24h === 0
    ? { id: "posts", level: "bad", title: "0 posts in 24 h", detail: "Nothing went out on @noswipe.app in the last 24 hours." }
    : { id: "posts", level: "ok", title: `${input.posts24h} posted in 24 h`, detail: "Posting is running." });

  if (input.queueNext24h === null) out.push({ id: "queue", level: "unknown", title: "Queue: unknown", detail: "Could not read the posting queue." });
  else out.push(input.queueNext24h === 0
    ? { id: "queue", level: "bad", title: "Queue empty for next 24 h", detail: "No video is scheduled in the next 24 hours." }
    : { id: "queue", level: "ok", title: `${input.queueNext24h} scheduled next 24 h`, detail: "The queue is stocked." });

  const cur = conversion(input.conv.paid, input.conv.visitors);
  const prev = conversion(input.conv.prevPaid, input.conv.prevVisitors);
  if (input.conv.visitors < MIN_VISITORS_FOR_CONVERSION_ALARM || prev === null || prev === 0 || cur === null) {
    out.push({ id: "conversion", level: "unknown", title: "Conversion: not enough data", detail: `Needs ≥${MIN_VISITORS_FOR_CONVERSION_ALARM} visitors this week and a paid reservation the week before.` });
  } else if (cur < prev * 0.5) {
    out.push({ id: "conversion", level: "bad", title: "Conversion down more than 50%", detail: `Visitor→paid ${(cur * 100).toFixed(2)}% vs ${(prev * 100).toFixed(2)}% the week before.` });
  } else {
    out.push({ id: "conversion", level: "ok", title: "Conversion steady", detail: `Visitor→paid ${(cur * 100).toFixed(2)}% vs ${(prev * 100).toFixed(2)}% the week before.` });
  }
  return out;
}

// ---------- Posting cadence ----------

/** YYYY-MM-DD of an instant in a time zone. */
export function dayKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

/** Posts per day for the last `days` days ending today, oldest first, in `timeZone`. */
export function postsPerDay(postedAt: (string | null)[], nowMs: number, days: number, timeZone: string): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const iso of postedAt) {
    const ms = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(ms)) continue;
    const k = dayKey(ms, timeZone);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = dayKey(nowMs - i * DAY, timeZone);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

/** Instagram shortcode from a post URL (…/reel/<code>/ or /p/<code>/), the value links carry as ?ref=. */
export function shortcodeFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

export { DIRECT_CHANNEL, NOT_CAPTURED_CHANNEL, normalizeChannel };
