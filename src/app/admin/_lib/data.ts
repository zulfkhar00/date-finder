import "server-only";
import { describeFiltered } from "@/lib/bot-quality";
import { computeRealFunnel, type RealFunnel } from "@/lib/real-funnel";
import { buildTrafficModel, computeAlarms, DAY, periodStats, type Alarm, type DimRow } from "@/lib/traffic-report";
import { loadTrafficRows } from "./traffic-data";
import { getQueueCounts } from "./queue-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LEAD_STAGES, RESERVATION_STATUSES, type LeadStage, type ReservationStatus } from "./data-shared";

// Every query here runs server-side with the service key, after the caller has checked
// ADMIN_EMAILS. Errors are logged by code only; row contents (emails, notes) never are.

export { LEAD_STAGES, RESERVATION_STATUSES, type LeadStage, type ReservationStatus };

export const DEFAULT_VARIANT_LABEL = "premium";
export const NO_CAMPAIGN_LABEL = "(none)";
export const LEADS_PAGE_SIZE = 50;
const EXPORT_MAX_ROWS = 50_000;
const FETCH_CHUNK = 1000;

export class AdminDataError extends Error {
  constructor(readonly where: string, readonly code: string | undefined) {
    super(`Admin query failed: ${where}`);
  }
  /** Missing function/table: the admin SQL file has not been applied yet. */
  get schemaMissing() {
    return this.code === "PGRST202" || this.code === "PGRST205" || this.code === "42883" || this.code === "42P01";
  }
}

function fail(where: string, error: { code?: string } | null): never {
  console.error("Admin query failed", where, error?.code ?? "unknown");
  throw new AdminDataError(where, error?.code);
}

// ---------- Overview ----------

export type FunnelRow = {
  variant: string;
  utm_campaign: string;
  visitors: number;
  reserve_starts: number;
  checkouts: number;
  paid: number;
};

export type DailyPoint = { day: string; pageViews: number; visitors: number; paid: number };

export type OverviewTotals = { visitors: number; getStarted: number; reserveStarts: number; onboardingComplete: number; checkouts: number; paid: number };

export type OverviewData = {
  funnel: FunnelRow[];
  daily: DailyPoint[];
  paidInRange: number;
  paidToday: number;
  paid7d: number;
  totals: OverviewTotals;
  /** Same-length window right before this one. null for "all time". */
  previous: OverviewTotals | null;
  topChannels: DimRow[];
  alarms: Alarm[];
  trafficCaptured: boolean;
  excluded: { founder: number; test_email: number; stripe_test: number; internalSessions: number };
  includeSuspect: boolean;
  /** "N sessions left out (why)" for the selected range; null when nothing was filtered. */
  filteredNote: string | null;
  suspectSessions: number;
  qualityColumn: boolean;
};

const toOverviewTotals = (f: RealFunnel): OverviewTotals => ({ visitors: f.visitors, getStarted: f.getStarted, reserveStarts: f.reserveStarts, onboardingComplete: f.onboardingComplete, checkouts: f.checkouts, paid: f.paid });

/** sinceDays = null means all time. Internal and test traffic is excluded (see lib/real-funnel). */
export async function getOverview(sinceDays: number | null, days = 30, includeSuspect = false): Promise<OverviewData> {
  const now = new Date();
  const nowMs = now.getTime();
  // Enough history for the previous period AND the alarms (24 h, and 7 d vs the 7 d before).
  const windowDays = sinceDays === null ? null : Math.max(sinceDays * 2, 14);
  let rows;
  try {
    rows = await loadTrafficRows(windowDays === null ? null : nowMs - windowDays * DAY);
  } catch {
    throw new AdminDataError("real_funnel", undefined);
  }
  const current = computeRealFunnel(rows.events, rows.reservations, sinceDays, now, undefined, { includeSuspect, internalUserIds: rows.internalUserIds });
  const previous = sinceDays === null ? null : computeRealFunnel(rows.events, rows.reservations, sinceDays * 2, now, nowMs - sinceDays * DAY, { includeSuspect, internalUserIds: rows.internalUserIds });

  const model = buildTrafficModel(rows.events, rows.reservations, undefined, { includeSuspect, nowMs, internalUserIds: rows.internalUserIds });
  let fromMs = nowMs - (sinceDays ?? 30) * DAY;
  if (sinceDays === null) for (const s of model.sessions.values()) fromMs = Math.min(fromMs, s.firstAt);
  const range = periodStats(model, fromMs, nowMs + 1);
  const week = periodStats(model, nowMs - 7 * DAY, nowMs + 1);
  const priorWeek = periodStats(model, nowMs - 14 * DAY, nowMs - 7 * DAY);
  const queue = await getQueueCounts(nowMs);
  const alarms = computeAlarms({
    visitors24h: periodStats(model, nowMs - DAY, nowMs + 1).totals.visitors,
    posts24h: queue?.posted24h ?? null,
    queueNext24h: queue?.scheduledNext24h ?? null,
    conv: { visitors: week.totals.visitors, paid: week.totals.paid, prevVisitors: priorWeek.totals.visitors, prevPaid: priorWeek.totals.paid }
  });

  return {
    funnel: current.rows,
    daily: current.daily.slice(-days),
    paidInRange: current.paid,
    paidToday: current.paidToday,
    paid7d: current.paid7d,
    totals: toOverviewTotals(current),
    previous: previous ? toOverviewTotals(previous) : null,
    topChannels: range.channels.slice(0, 5),
    alarms,
    trafficCaptured: rows.trafficColumns && model.captureSince !== null,
    excluded: current.excluded,
    includeSuspect,
    filteredNote: describeFiltered(current.qualityFiltered),
    suspectSessions: current.suspectSessions,
    qualityColumn: rows.qualityColumn
  };
}

// ---------- Leads ----------

export type LeadFilters = {
  status?: ReservationStatus;
  variant?: string;
  campaign?: string;
  q?: string;
};

export type LeadRow = {
  id: string;
  created_at: string;
  email: string;
  city: string;
  dating_preference: string;
  relationship_goal: string;
  date_frequency: string;
  status: ReservationStatus;
  queue_position: number | null;
  variant: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  paid_at: string | null;
};

const LEAD_COLUMNS =
  "id, created_at, email, city, dating_preference, relationship_goal, date_frequency, status, queue_position, variant, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, paid_at";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses untrusted query params into filters. Unknown values are dropped. */
export function parseLeadFilters(params: Record<string, string | string[] | undefined>): LeadFilters & { page: number } {
  const status = first(params.status);
  const variant = first(params.variant)?.trim().slice(0, 32);
  const campaign = first(params.campaign)?.trim().slice(0, 200);
  const q = first(params.q)?.trim().slice(0, 254);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    status: (RESERVATION_STATUSES as readonly string[]).includes(status ?? "") ? (status as ReservationStatus) : undefined,
    variant: variant || undefined,
    campaign: campaign || undefined,
    q: q || undefined,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function selectLeads(filters: LeadFilters, withCount: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("reservations").select(LEAD_COLUMNS, withCount ? { count: "exact" } : undefined);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.variant) {
    query = filters.variant === DEFAULT_VARIANT_LABEL
      ? query.or(`variant.is.null,variant.eq.${DEFAULT_VARIANT_LABEL}`)
      : query.eq("variant", filters.variant);
  }
  if (filters.campaign) {
    query = filters.campaign === NO_CAMPAIGN_LABEL ? query.is("utm_campaign", null) : query.eq("utm_campaign", filters.campaign);
  }
  if (filters.q) query = query.ilike("email", `%${escapeLike(filters.q.toLowerCase())}%`);
  return query.order("created_at", { ascending: false }).order("id", { ascending: true });
}

async function stagesFor(ids: string[]): Promise<Map<string, LeadStage>> {
  const stages = new Map<string, LeadStage>();
  if (ids.length === 0) return stages;
  const { data, error } = await getSupabaseAdmin().from("lead_notes").select("reservation_id, stage").in("reservation_id", ids);
  if (error) {
    // Before the admin SQL is applied the table is missing; show leads without stages.
    console.error("Admin query failed", "lead_stages", error.code ?? "unknown");
    return stages;
  }
  for (const row of data ?? []) stages.set(row.reservation_id as string, row.stage as LeadStage);
  return stages;
}

export type LeadWithStage = LeadRow & { stage: LeadStage };

export async function listLeads(filters: LeadFilters, page: number): Promise<{ rows: LeadWithStage[]; total: number }> {
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const { data, error, count } = await selectLeads(filters, true).range(from, from + LEADS_PAGE_SIZE - 1);
  if (error) {
    // Asking for a page past the end is not an error worth surfacing.
    if (error.code === "PGRST103") return { rows: [], total: count ?? 0 };
    fail("leads", error);
  }
  const rows = (data ?? []) as unknown as LeadRow[];
  const stages = await stagesFor(rows.map((row) => row.id));
  return { rows: rows.map((row) => ({ ...row, stage: stages.get(row.id) ?? "new" })), total: count ?? 0 };
}

/** All matching leads for CSV export, newest first, capped at EXPORT_MAX_ROWS. */
export async function exportLeads(filters: LeadFilters): Promise<LeadWithStage[]> {
  const rows: LeadRow[] = [];
  for (let from = 0; from < EXPORT_MAX_ROWS; from += FETCH_CHUNK) {
    const { data, error } = await selectLeads(filters, false).range(from, from + FETCH_CHUNK - 1);
    if (error) fail("leads_export", error);
    const chunk = (data ?? []) as unknown as LeadRow[];
    rows.push(...chunk);
    if (chunk.length < FETCH_CHUNK) break;
  }
  const stages = new Map<string, LeadStage>();
  for (let i = 0; i < rows.length; i += 200) {
    const part = await stagesFor(rows.slice(i, i + 200).map((row) => row.id));
    for (const [id, stage] of part) stages.set(id, stage);
  }
  return rows.map((row) => ({ ...row, stage: stages.get(row.id) ?? "new" }));
}

export type LeadFacets = { variants: string[]; campaigns: string[] };

export async function getLeadFacets(): Promise<LeadFacets> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_lead_facets");
  if (error) {
    console.error("Admin query failed", "lead_facets", error.code ?? "unknown");
    return { variants: [], campaigns: [] };
  }
  const rows = (data ?? []) as { kind: string; value: string }[];
  return {
    variants: rows.filter((row) => row.kind === "variant").map((row) => row.value),
    campaigns: rows.filter((row) => row.kind === "utm_campaign").map((row) => row.value)
  };
}

// ---------- Lead detail ----------

export type LeadNotes = { stage: LeadStage; notes: string; updated_at: string | null; updated_by: string | null; available: boolean };
export type FunnelEventRow = { event: string; created_at: string; variant: string | null; utm_campaign: string | null };
/** Onboarding answers (supabase/2026-10-23-onboarding.sql). available=false until that file is applied. */
export type LeadOnboarding = { available: boolean; data: Record<string, unknown> | null };
export type LeadDetail = LeadRow & {
  onboarding: LeadOnboarding;
  age_confirmed_at: string;
  terms_accepted_at: string;
  refund_requested_at: string | null;
  has_checkout: boolean;
  notes: LeadNotes;
  events: FunnelEventRow[];
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getLead(id: string): Promise<LeadDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reservations")
    .select(`${LEAD_COLUMNS}, age_confirmed_at, terms_accepted_at, refund_requested_at, stripe_checkout_session_id`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("lead", error);
  if (!data) return null;
  const { stripe_checkout_session_id: checkoutId, ...lead } = data as unknown as LeadRow & {
    age_confirmed_at: string;
    terms_accepted_at: string;
    refund_requested_at: string | null;
    stripe_checkout_session_id: string | null;
  };

  const notesResult = await supabase.from("lead_notes").select("stage, notes, updated_at, updated_by").eq("reservation_id", id).maybeSingle();
  if (notesResult.error) console.error("Admin query failed", "lead_notes", notesResult.error.code ?? "unknown");
  const notes: LeadNotes = notesResult.error
    ? { stage: "new", notes: "", updated_at: null, updated_by: null, available: false }
    : {
        stage: (notesResult.data?.stage as LeadStage | undefined) ?? "new",
        notes: (notesResult.data?.notes as string | undefined) ?? "",
        updated_at: (notesResult.data?.updated_at as string | undefined) ?? null,
        updated_by: (notesResult.data?.updated_by as string | undefined) ?? null,
        available: true
      };

  // Separate query so a missing onboarding column never breaks the rest of the lead page.
  const onboardingResult = await supabase.from("reservations").select("onboarding").eq("id", id).maybeSingle();
  if (onboardingResult.error) console.error("Admin query failed", "lead_onboarding", onboardingResult.error.code ?? "unknown");
  const rawOnboarding = (onboardingResult.data as { onboarding?: unknown } | null)?.onboarding;
  const onboarding: LeadOnboarding = {
    available: !onboardingResult.error,
    data: rawOnboarding && typeof rawOnboarding === "object" && !Array.isArray(rawOnboarding) ? (rawOnboarding as Record<string, unknown>) : null
  };

  // The funnel session is linked to the reservation through its checkout_created event.
  let events: FunnelEventRow[] = [];
  if (checkoutId) {
    const origin = await supabase.from("funnel_events").select("session_id").eq("dedupe_key", `checkout_created:${checkoutId}`).maybeSingle();
    if (origin.error) console.error("Admin query failed", "lead_session", origin.error.code ?? "unknown");
    const sessionId = origin.data?.session_id as string | null | undefined;
    const sessionEvents = sessionId
      ? await supabase.from("funnel_events").select("event, created_at, variant, utm_campaign").eq("session_id", sessionId).order("created_at").limit(100)
      : await supabase.from("funnel_events").select("event, created_at, variant, utm_campaign").in("dedupe_key", [`checkout_created:${checkoutId}`, `paid:${checkoutId}`]).order("created_at");
    if (sessionEvents.error) console.error("Admin query failed", "lead_events", sessionEvents.error.code ?? "unknown");
    else events = (sessionEvents.data ?? []) as FunnelEventRow[];
  }

  return { ...lead, has_checkout: Boolean(checkoutId), notes, onboarding, events };
}

export async function saveLeadNotes(id: string, stage: LeadStage, notes: string, adminEmail: string): Promise<"saved" | "missing" | "unavailable"> {
  const { error } = await getSupabaseAdmin()
    .from("lead_notes")
    .upsert({ reservation_id: id, stage, notes, updated_at: new Date().toISOString(), updated_by: adminEmail }, { onConflict: "reservation_id" });
  if (!error) return "saved";
  console.error("Admin query failed", "save_lead_notes", error.code ?? "unknown");
  if (error.code === "23503") return "missing";
  return "unavailable";
}
