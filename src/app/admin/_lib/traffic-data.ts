import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, loadInternalUserIds, RESERVATION_COLUMNS, type ReservationRow } from "@/lib/real-funnel";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { TrafficEvent } from "@/lib/traffic-report";

// Reads funnel_events (with the traffic columns when the migration is applied) and reservations.
// Row contents are never logged; only error codes.

const PAGE = 1000;
const MAX_ROWS = 100_000;
const BASE_COLUMNS = "id, created_at, event, session_id, variant, utm_campaign, dedupe_key, ref";
const ACCOUNT_COLS = "user_id, account_internal";
const TRAFFIC_COLS = "utm_source, utm_medium, utm_content, referrer_host, landing_path, device, country";

export type TrafficRows = {
  events: TrafficEvent[];
  /** Stripe Checkout Session id -> first-touch source (empty until 2026-11-21-first-touch.sql is applied). */
  firstTouchByStripe: Map<string, string>;
  /** false until supabase/2026-11-21-first-touch.sql is applied. */
  inAppColumn: boolean;
  /** false until supabase/2026-11-22-session-quality.sql is applied: only device = 'bot' and behaviour classify sessions. */
  qualityColumn: boolean;
  reservations: ReservationRow[];
  /** Accounts flagged internal on their profile; with funnel_events.account_internal they drop signed-in internal sessions. */
  internalUserIds: Set<string>;
  /** false until supabase/2026-11-03-traffic.sql is applied (the columns do not exist yet). */
  trafficColumns: boolean;
};

function undefinedColumn(error: { code?: string | null } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

async function pageEvents(supabase: SupabaseClient, columns: string, sinceIso: string | null): Promise<{ rows: TrafficEvent[]; error: { code?: string | null } | null }> {
  const rows: TrafficEvent[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let query = supabase.from("funnel_events").select(columns).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (sinceIso) query = query.gte("created_at", sinceIso);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...((data ?? []) as unknown as TrafficEvent[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

/** `sinceMs` null = everything. Throws on a real read failure; callers show an error, never a made-up zero. */
export async function loadTrafficRows(sinceMs: number | null): Promise<TrafficRows> {
  const supabase = getSupabaseAdmin();
  const sinceIso = sinceMs === null ? null : new Date(sinceMs).toISOString();
  let trafficColumns = true;
  let inAppColumn = true;
  let qualityColumn = true;
  // Newest shape first; each missing-column error falls to the next (account link, then quality, then in-app source, then traffic columns).
  let result = await pageEvents(supabase, `${BASE_COLUMNS}, ${TRAFFIC_COLS}, in_app_source, quality, ${ACCOUNT_COLS}`, sinceIso);
  if (undefinedColumn(result.error)) result = await pageEvents(supabase, `${BASE_COLUMNS}, ${TRAFFIC_COLS}, in_app_source, quality`, sinceIso);
  if (undefinedColumn(result.error)) {
    qualityColumn = false;
    result = await pageEvents(supabase, `${BASE_COLUMNS}, ${TRAFFIC_COLS}, in_app_source`, sinceIso);
  }
  if (undefinedColumn(result.error)) {
    inAppColumn = false;
    result = await pageEvents(supabase, `${BASE_COLUMNS}, ${TRAFFIC_COLS}`, sinceIso);
  }
  if (undefinedColumn(result.error)) {
    trafficColumns = false;
    result = await pageEvents(supabase, BASE_COLUMNS, sinceIso);
  }
  if (result.error) {
    console.error("Admin traffic query failed", "funnel_events", result.error.code ?? "unknown");
    throw new Error("Admin traffic query failed: funnel_events");
  }
  // All reservations: a paid_at inside the window can belong to an older row.
  const reservations = await fetchAllRows<ReservationRow>("reservations", RESERVATION_COLUMNS, supabase, null, "created_at");
  const internalUserIds = await loadInternalUserIds(supabase);
  return { events: result.rows, reservations, trafficColumns, inAppColumn, qualityColumn, firstTouchByStripe: await loadFirstTouch(supabase), internalUserIds };
}

/** Best effort: the first-touch columns may not exist yet, and a failure here must never blank the page. */
async function loadFirstTouch(supabase: SupabaseClient): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase.from("reservations").select("stripe_checkout_session_id, first_touch_source").not("first_touch_source", "is", null).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) {
        if (!undefinedColumn(error)) console.error("Admin traffic query failed", "reservations first touch", error.code ?? "unknown");
        return out;
      }
      for (const r of (data ?? []) as { stripe_checkout_session_id: string | null; first_touch_source: string | null }[]) {
        if (r.stripe_checkout_session_id && r.first_touch_source) out.set(r.stripe_checkout_session_id, r.first_touch_source);
      }
      if (!data || data.length < PAGE) break;
    }
  } catch {
    console.error("Admin traffic query failed", "reservations first touch", "exception");
  }
  return out;
}
