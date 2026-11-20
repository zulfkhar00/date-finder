import "server-only";
import { computeCheckoutReport, type CheckoutEventRow, type CheckoutReport } from "@/lib/checkout-report";
import { fetchAllRows, loadInternalUserIds, RESERVATION_COLUMNS, type ReservationRow } from "@/lib/real-funnel";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Loads the last 30 days of funnel_events (with device / country / detail when the migration is in) and
// every reservation, then hands them to the pure report. Row contents are never logged, only codes.

const DAY = 24 * 60 * 60 * 1000;
const ACCOUNT_COLUMNS = "user_id, account_internal";
const ACCOUNT_FULL_COLUMNS = `id, created_at, event, session_id, dedupe_key, device, country, detail, ${ACCOUNT_COLUMNS}`;
const FULL_COLUMNS = "id, created_at, event, session_id, dedupe_key, device, country, detail";
const TRAFFIC_ONLY_COLUMNS = "id, created_at, event, session_id, dedupe_key, device, country";
const BASE_COLUMNS = "id, created_at, event, session_id, dedupe_key";

export type CheckoutPanel = CheckoutReport & {
  /** false until supabase/2026-11-20-checkout-forensics.sql is applied: only the opened / paid steps exist. */
  diagnosticsCaptured: boolean;
  /** false until a funnel row carries country or device. */
  geoCaptured: boolean;
};

export async function getCheckoutPanel(now = new Date()): Promise<CheckoutPanel> {
  const supabase = getSupabaseAdmin();
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  let events: CheckoutEventRow[] | null = null;
  let diagnosticsCaptured = false;
  for (const columns of [ACCOUNT_FULL_COLUMNS, FULL_COLUMNS, TRAFFIC_ONLY_COLUMNS, BASE_COLUMNS]) {
    try {
      events = await fetchAllRows<CheckoutEventRow>("funnel_events", columns, supabase, since, "created_at");
      diagnosticsCaptured = columns === FULL_COLUMNS || columns === ACCOUNT_FULL_COLUMNS; // the detail column exists only after the migration
      break;
    } catch {
      // retry with fewer columns; a real outage fails all three
    }
  }
  if (!events) throw new Error("Checkout panel: funnel_events unreadable");

  let reservations: (ReservationRow & { city?: string | null })[];
  try {
    reservations = await fetchAllRows<ReservationRow & { city?: string | null }>("reservations", `${RESERVATION_COLUMNS}, city`, supabase, null, "created_at");
  } catch {
    reservations = await fetchAllRows<ReservationRow>("reservations", RESERVATION_COLUMNS, supabase, null, "created_at");
  }

  const report = computeCheckoutReport(events, reservations, now, 30, await loadInternalUserIds(supabase));
  return { ...report, diagnosticsCaptured, geoCaptured: events.some((e) => Boolean(e.country || e.device)) };
}
