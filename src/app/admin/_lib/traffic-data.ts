import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, RESERVATION_COLUMNS, type ReservationRow } from "@/lib/real-funnel";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { TrafficEvent } from "@/lib/traffic-report";

// Reads funnel_events (with the traffic columns when the migration is applied) and reservations.
// Row contents are never logged; only error codes.

const PAGE = 1000;
const MAX_ROWS = 100_000;
const BASE_COLUMNS = "id, created_at, event, session_id, variant, utm_campaign, dedupe_key, ref";
const TRAFFIC_COLS = "utm_source, utm_medium, utm_content, referrer_host, landing_path, device, country";

export type TrafficRows = {
  events: TrafficEvent[];
  reservations: ReservationRow[];
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
  let result = await pageEvents(supabase, `${BASE_COLUMNS}, ${TRAFFIC_COLS}`, sinceIso);
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
  return { events: result.rows, reservations, trafficColumns };
}
