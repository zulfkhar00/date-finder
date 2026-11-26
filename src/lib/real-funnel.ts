import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { counts as qualityCounts, sessionQualities, summariseFiltered, type FilteredSessions, type QualityEvent } from "@/lib/bot-quality";
import { CHECKOUT_DIAGNOSTIC_EVENTS, checkoutIdFromKey } from "@/lib/checkout-events";
import { PROBE_SESSION_PREFIX, reservationExclusion } from "@/lib/internal-traffic";

// The one place funnel numbers are computed. It reads raw rows with the server key and drops
// internal and test traffic, so the Telegram digest and /admin agree and never count the founders.
//
// Excluded:
//  - reservations from founder emails (incl. +aliases), test/example emails, junk digit-only emails
//  - reservations created in Stripe test mode (cs_test_ sessions)
//  - every funnel session that reached a checkout belonging to an excluded reservation
//  - our own probe sessions (PROBE_SESSION_PREFIX)
//  - every funnel session in which the browser was SIGNED IN to an internal account (a founder / test email
//    at the time of the event, or a profile flagged `internal`), even if it never reached a checkout.
//    The link is the server-read sign-in cookie (funnel_events.user_id / account_internal), the same session
//    id covers the guest events before sign-in in that tab. Never inferred from IP, device or user agent.
//    Rows from before supabase/2026-11-22-funnel-account-link.sql carry no account and cannot be classified.
// Localhost and preview deployments are not recorded at all (see /api/event), so there is nothing to drop.

const PAGE = 1000;
const MAX_ROWS = 50_000;
const DAY = 24 * 60 * 60 * 1000;

type EventRow = Partial<Pick<QualityEvent, "device" | "quality" | "utm_source" | "referrer_host" | "in_app_source" | "landing_path" | "country">> & { created_at: string; event: string; session_id: string | null; variant: string | null; utm_campaign: string | null; dedupe_key: string | null;
  /** Signed-in account behind the event; absent/null for guests and for rows from before the account link. */
  user_id?: string | null; account_internal?: boolean | null;
};
type ReservationRow = {
  created_at: string; email: string; status: string; paid_at: string | null;
  stripe_checkout_session_id: string | null; variant: string | null; utm_campaign: string | null;
};

export type Exclusions = { founder: number; test_email: number; stripe_test: number; internalSessions: number };
export type RealFunnelRow = { variant: string; utm_campaign: string; visitors: number; reserve_starts: number; checkouts: number; paid: number };
export type RealFunnel = {
  sinceDays: number | null;
  visitors: number;
  getStarted: number;
  reserveStarts: number;
  onboardingComplete: number;
  checkouts: number;
  paid: number;
  rows: RealFunnelRow[];
  daily: { day: string; pageViews: number; visitors: number; paid: number }[];
  excluded: Exclusions;
  /** Sessions left out as bots / suspect in the window, with reasons. Bots are never counted; suspect only when asked for. */
  qualityFiltered: FilteredSessions;
  /** Suspect sessions in the window that including them would add back (0 when they are already in). */
  suspectSessions: number;
  /** Real paid reservations by paid_at, for "today" and "last 7 days" tiles. */
  paidToday: number;
  paid7d: number;
};

/** A failed page read. `code` is the PostgREST/Postgres code only; never row contents. */
export class FetchError extends Error {
  constructor(readonly table: string, readonly code: string | undefined) {
    super(`Real funnel query failed: ${table}`);
  }
}

async function fetchAll<T>(table: string, columns: string, supabase: SupabaseClient, since: string | null, dateColumn: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let query = supabase.from(table).select(columns).order(dateColumn, { ascending: true }).order("id", { ascending: true });
    if (since) query = query.gte(dateColumn, since);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) {
      console.error("Real funnel query failed", table, error.code ?? "unknown");
      throw new FetchError(table, error.code);
    }
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const utcDay = (iso: string) => iso.slice(0, 10);

const EVENT_COLUMNS = "id, created_at, event, session_id, variant, utm_campaign, dedupe_key";
const ACCOUNT_COLUMNS = "user_id, account_internal";

export function isUndefinedColumnError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Ids of accounts flagged `internal` on their profile (founders, test accounts, anything an admin marked).
 * Throws when unreadable: a funnel computed without it could count internal sessions, so callers show "n/a".
 */
export async function loadInternalUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase.from("profiles").select("user_id").eq("internal", true).order("user_id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      console.error("Real funnel query failed", "profiles", error.code ?? "unknown");
      throw new Error("Real funnel query failed: profiles");
    }
    for (const row of (data ?? []) as { user_id: string }[]) ids.add(row.user_id.toLowerCase());
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

/** `sinceDays` null = all time. Throws if a table cannot be read (callers show "n/a", never a made-up zero). */
export async function getRealFunnel(supabase: SupabaseClient, sinceDays: number | null, now = new Date(), options: { includeSuspect?: boolean } = {}): Promise<RealFunnel> {
  const since = sinceDays === null ? null : new Date(now.getTime() - sinceDays * DAY).toISOString();
  const [events, allReservations, internalUserIds] = await Promise.all([
    fetchEventsWithQuality(supabase, since),
    // All reservations, not just the window: a paid_at inside the window can belong to an older row.
    fetchAll<ReservationRow>("reservations", RESERVATION_COLUMNS, supabase, null, "created_at"),
    loadInternalUserIds(supabase)
  ]);
  return computeRealFunnel(events, allReservations, sinceDays, now, undefined, { ...options, internalUserIds });
}

// The quality columns exist only after supabase/2026-11-22-session-quality.sql (quality) and 2026-11-03 / 2026-11-21 (traffic).
const QUALITY_EVENT_COLUMNS = [`${EVENT_COLUMNS}, device, country, utm_source, referrer_host, in_app_source, landing_path, quality, ${ACCOUNT_COLUMNS}`, `${EVENT_COLUMNS}, device, country, utm_source, referrer_host, in_app_source, landing_path, quality`, `${EVENT_COLUMNS}, device, country, utm_source, referrer_host, landing_path`];

async function fetchEventsWithQuality(supabase: SupabaseClient, since: string | null): Promise<EventRow[]> {
  for (const columns of QUALITY_EVENT_COLUMNS) {
    try {
      return await fetchAll<EventRow>("funnel_events", columns, supabase, since, "created_at");
    } catch {
      // a missing column: fall back to fewer
    }
  }
  return fetchAll<EventRow>("funnel_events", EVENT_COLUMNS, supabase, since, "created_at");
}

export const RESERVATION_COLUMNS = "id, created_at, email, status, paid_at, stripe_checkout_session_id, variant, utm_campaign";
export { fetchAll as fetchAllRows };
export type { EventRow, ReservationRow };

/**
 * Funnel sessions that belong to our own probes or to an excluded (founder / test / Stripe test)
 * checkout. Shared with the traffic report so every admin number drops the same sessions.
 */
export function internalSessionIds(events: Pick<EventRow, "event" | "session_id" | "dedupe_key" | "user_id" | "account_internal">[], badStripeSessions: Set<string>, internalUserIds: ReadonlySet<string> = new Set()): Set<string> {
  const stripeIdOf = (key: string | null) => (key ? key.slice(key.indexOf(":") + 1) : "");
  const internal = new Set<string>();
  for (const e of events) {
    if (e.session_id?.startsWith(PROBE_SESSION_PREFIX)) internal.add(e.session_id);
    // Signed in as an internal account at any point of this tab session: the whole session (guest part too) is internal.
    if (e.session_id && (e.account_internal === true || (e.user_id && internalUserIds.has(e.user_id.toLowerCase())))) internal.add(e.session_id);
    if (e.session_id && (e.event === "checkout_created" || e.event === "paid")) {
      const id = stripeIdOf(e.dedupe_key);
      if (badStripeSessions.has(id) || id.startsWith("cs_test_")) internal.add(e.session_id);
    } else if (e.session_id && CHECKOUT_DIAGNOSTIC_EVENTS.has(e.event)) {
      const id = checkoutIdFromKey(e.dedupe_key);
      if (id && (badStripeSessions.has(id) || id.startsWith("cs_test_"))) internal.add(e.session_id);
    }
  }
  return internal;
}

/** Real reservations plus the Stripe sessions of the excluded ones. `since`/`untilIso` only bound the exclusion counts. */
export function splitReservations(all: ReservationRow[], since: string | null, untilIso: string | null) {
  const excluded: Exclusions = { founder: 0, test_email: 0, stripe_test: 0, internalSessions: 0 };
  const badStripeSessions = new Set<string>();
  const real: ReservationRow[] = [];
  for (const row of all) {
    const reason = reservationExclusion(row);
    if (!reason) { real.push(row); continue; }
    if (row.stripe_checkout_session_id) badStripeSessions.add(row.stripe_checkout_session_id);
    if ((!since || row.created_at >= since) && (!untilIso || row.created_at < untilIso)) excluded[reason] += 1;
  }
  return { real, badStripeSessions, excluded };
}

/**
 * The pure half of getRealFunnel: takes rows already fetched (events may cover more than the window)
 * and computes the window [now - sinceDays, untilMs). `untilMs` is how the previous period is built.
 */
export function computeRealFunnel(allEvents: EventRow[], allReservations: ReservationRow[], sinceDays: number | null, now = new Date(), untilMs?: number, options: { includeSuspect?: boolean; internalUserIds?: ReadonlySet<string> } = {}): RealFunnel {
  const includeSuspect = options.includeSuspect ?? false;
  const since = sinceDays === null ? null : new Date(now.getTime() - sinceDays * DAY).toISOString();
  const untilIso = untilMs === undefined ? null : new Date(untilMs).toISOString();
  const events = allEvents.filter((e) => (!since || e.created_at >= since) && (!untilIso || e.created_at < untilIso));
  const { real, badStripeSessions, excluded } = splitReservations(allReservations, since, untilIso);
  // Sessions are judged on ALL fetched events: the checkout that marks a session internal may sit outside the window.
  const internalSessions = internalSessionIds(allEvents, badStripeSessions, options.internalUserIds);
  const windowSessions = new Set(events.map((e) => e.session_id));
  excluded.internalSessions = [...internalSessions].filter((id) => windowSessions.has(id)).length;

  const qualities = sessionQualities(allEvents.filter((e) => !(e.session_id && internalSessions.has(e.session_id))), now.getTime());
  const sessions = new Map<string, { variant: string; campaign: string; pageView: boolean; getStarted: boolean; started: boolean; done: boolean }>();
  const daily = new Map<string, { pageViews: number; visitors: Set<string> }>();
  for (const e of events) {
    if (!e.session_id || internalSessions.has(e.session_id)) continue;
    if (!qualityCounts(qualities.get(e.session_id)?.quality, { includeSuspect })) continue;
    if (e.event === "checkout_created" || e.event === "paid" || CHECKOUT_DIAGNOSTIC_EVENTS.has(e.event)) continue; // server events: reservations are the source of truth; diagnostics only feed the Checkout panel
    let s = sessions.get(e.session_id);
    if (!s) { s = { variant: e.variant ?? "premium", campaign: e.utm_campaign ?? "(none)", pageView: false, getStarted: false, started: false, done: false }; sessions.set(e.session_id, s); }
    if (e.event === "page_view") {
      s.pageView = true;
      const d = daily.get(utcDay(e.created_at)) ?? { pageViews: 0, visitors: new Set<string>() };
      d.pageViews += 1; d.visitors.add(e.session_id); daily.set(utcDay(e.created_at), d);
    }
    if (e.event === "get_started") s.getStarted = true;
    if (e.event === "reserve_start") s.started = true;
    if (e.event === "onboarding_complete") s.done = true;
  }

  const inRangeMs = (ms: number) => (!since || ms >= Date.parse(since)) && (!untilIso || ms < Date.parse(untilIso));
  const rows = new Map<string, RealFunnelRow>();
  const rowFor = (variant: string, campaign: string) => {
    const key = `${variant}\u0000${campaign}`;
    let r = rows.get(key);
    if (!r) { r = { variant, utm_campaign: campaign, visitors: 0, reserve_starts: 0, checkouts: 0, paid: 0 }; rows.set(key, r); }
    return r;
  };
  let visitors = 0, getStarted = 0, reserveStarts = 0, onboardingComplete = 0;
  for (const s of sessions.values()) {
    const r = rowFor(s.variant, s.campaign);
    if (s.pageView) { visitors += 1; r.visitors += 1; }
    if (s.getStarted) getStarted += 1;
    if (s.started) { reserveStarts += 1; r.reserve_starts += 1; }
    if (s.done) onboardingComplete += 1;
  }

  const inWindow = (iso: string | null) => !!iso && (!since || iso >= since) && (!untilIso || iso < untilIso);
  const paidRows = real.filter((r) => r.status === "paid");
  let checkouts = 0, paid = 0;
  for (const r of real) {
    if (inWindow(r.created_at)) { checkouts += 1; rowFor(r.variant ?? "premium", r.utm_campaign ?? "(none)").checkouts += 1; }
  }
  for (const r of paidRows) {
    if (inWindow(r.paid_at)) { paid += 1; rowFor(r.variant ?? "premium", r.utm_campaign ?? "(none)").paid += 1; }
  }
  const paidByDay = new Map<string, number>();
  for (const r of paidRows) if (r.paid_at) paidByDay.set(utcDay(r.paid_at), (paidByDay.get(utcDay(r.paid_at)) ?? 0) + 1);

  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const series = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = utcDay(new Date(todayStart - i * DAY).toISOString());
    const d = daily.get(day);
    series.push({ day, pageViews: d?.pageViews ?? 0, visitors: d?.visitors.size ?? 0, paid: paidByDay.get(day) ?? 0 });
  }

  return {
    sinceDays, visitors, getStarted, reserveStarts, onboardingComplete, checkouts, paid,
    rows: [...rows.values()].filter((r) => r.visitors + r.reserve_starts + r.checkouts + r.paid > 0),
    daily: series, excluded,
    qualityFiltered: summariseFiltered(qualities, { includeSuspect }, inRangeMs),
    suspectSessions: includeSuspect ? 0 : summariseFiltered(qualities, { includeSuspect }, inRangeMs).suspect,
    paidToday: paidRows.filter((r) => r.paid_at && Date.parse(r.paid_at) >= todayStart).length,
    paid7d: paidRows.filter((r) => r.paid_at && Date.parse(r.paid_at) >= now.getTime() - 7 * DAY).length
  };
}
