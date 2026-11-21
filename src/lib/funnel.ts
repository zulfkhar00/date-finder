import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelEventName } from "@/lib/attribution";
import type { CheckoutDetail } from "@/lib/checkout-events";
import { firstTouchColumns, type FirstTouch, type TrafficFields } from "@/lib/traffic";

type FunnelEvent = {
  event: FunnelEventName;
  sessionId?: string | null;
  variant?: string | null;
  utmCampaign?: string | null;
  ref?: string | null;
  /** Source, landing page, device, country (supabase/2026-11-03-traffic.sql). */
  traffic?: Partial<TrafficFields>;
  /** First-touch source/medium/campaign/landing (supabase/2026-11-21-first-touch.sql); sent on checkout_created and paid. */
  firstTouch?: FirstTouch | null;
  /** Checkout diagnostics (supabase/2026-11-20-checkout-forensics.sql): short whitelisted tokens only. */
  detail?: CheckoutDetail;
  /** When set, a repeated insert with the same key is ignored (e.g. Stripe webhook retries, double fires). */
  dedupeKey?: string;
};

/**
 * The insert shapes to try, newest first. Optional columns may not exist yet (migration not applied):
 * an undefined-column error falls to the next shape, dropping detail, then traffic, then ref, so events
 * keep flowing before every migration is in. Shapes that would repeat the previous one are skipped.
 */
export function funnelRowAttempts(input: FunnelEvent): Record<string, unknown>[] {
  const base: Record<string, unknown> = {
    event: input.event,
    session_id: input.sessionId ?? null,
    variant: input.variant ?? null,
    utm_campaign: input.utmCampaign ?? null,
    dedupe_key: input.dedupeKey ?? null
  };
  const allTraffic = Object.fromEntries(Object.entries({ ...(input.traffic ?? {}), ...firstTouchColumns(input.firstTouch ?? null) }).filter(([, value]) => value !== null && value !== undefined));
  // Columns from 2026-11-21-first-touch.sql: dropped first, so the older traffic columns keep flowing before it is applied.
  // quality (2026-11-22-session-quality.sql) is the newest column: it goes first when the migration is not in.
  const withoutQuality = Object.fromEntries(Object.entries(allTraffic).filter(([key]) => key !== "quality"));
  const traffic = Object.fromEntries(Object.entries(withoutQuality).filter(([key]) => key !== "in_app_source" && !key.startsWith("first_touch_")));
  const detail = input.detail && Object.keys(input.detail).length > 0 ? { detail: input.detail } : {};
  const ref = input.ref ? { ref: input.ref } : {};
  const shapes = [{ ...base, ...ref, ...allTraffic, ...detail }, { ...base, ...ref, ...withoutQuality, ...detail }, { ...base, ...ref, ...traffic, ...detail }, { ...base, ...ref, ...traffic }, { ...base, ...ref }, base];
  return shapes.filter((row, i) => i === 0 || Object.keys(row).length !== Object.keys(shapes[i - 1]).length);
}

type InsertResult = { ok: true; inserted: boolean | null } | { ok: false; code: string };

async function insertFunnelRow(supabase: SupabaseClient, input: FunnelEvent): Promise<InsertResult> {
  let error: { code?: string | null } | null = null;
  let inserted: boolean | null = null;
  for (const row of funnelRowAttempts(input)) {
    if (input.dedupeKey) {
      const result = await supabase.from("funnel_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
      error = result.error;
      inserted = error ? null : (result.data?.length ?? 0) > 0;
    } else {
      ({ error } = await supabase.from("funnel_events").insert(row));
    }
    if (!error || !isUndefinedColumn(error)) break;
  }
  if (error) return { ok: false, code: error.code || "unknown" };
  return { ok: true, inserted };
}

/**
 * Records a funnel event. Never throws: if the funnel_events table is missing or the insert
 * fails, it logs the error code only and returns, so checkout and webhooks keep working.
 * With a dedupeKey, resolves true if this call inserted the row, false if it already existed,
 * and null when unknown (insert failed). Without one, resolves null.
 */
export async function recordFunnelEvent(supabase: SupabaseClient, input: FunnelEvent): Promise<boolean | null> {
  try {
    const result = await insertFunnelRow(supabase, input);
    if (!result.ok) {
      console.error("Funnel event insert failed", input.event, result.code);
      return null;
    }
    return input.dedupeKey ? result.inserted : null;
  } catch (error) {
    console.error("Funnel event insert failed", input.event, error instanceof Error ? error.name : "unknown error");
    return null;
  }
}

/**
 * Insert for browser events. Unlike recordFunnelEvent it reports failure (Postgres/PostgREST error
 * code, e.g. 23514 when funnel_events_event_check predates a new event) so /api/event can answer 503
 * instead of a silent 204. A repeat of a dedupeKey is a success (nothing to do). Never throws, never
 * logs row contents.
 */
export async function insertClientFunnelEvent(supabase: SupabaseClient, input: FunnelEvent): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const result = await insertFunnelRow(supabase, input);
    if (!result.ok) {
      console.error("Funnel event insert failed", input.event, result.code);
      return { ok: false, code: result.code };
    }
    return { ok: true };
  } catch (error) {
    console.error("Funnel event insert failed", input.event, error instanceof Error ? error.name : "unknown error");
    return { ok: false, code: "exception" };
  }
}

export type CheckoutOrigin = {
  session_id: string | null; variant: string | null; utm_campaign: string | null; ref?: string | null; device?: string | null; country?: string | null;
  first_touch_source?: string | null; first_touch_medium?: string | null; first_touch_campaign?: string | null; first_touch_landing?: string | null;
};

/** The checkout_created row of a Checkout Session: which funnel session, campaign, device and country it belongs to. Never throws. */
export async function lookupCheckoutOrigin(supabase: SupabaseClient, checkoutSessionId: string): Promise<CheckoutOrigin | null> {
  const key = `checkout_created:${checkoutSessionId}`;
  try {
    for (const columns of ["session_id, variant, utm_campaign, ref, device, country, first_touch_source, first_touch_medium, first_touch_campaign, first_touch_landing", "session_id, variant, utm_campaign, ref, device, country", "session_id, variant, utm_campaign, ref", "session_id, variant, utm_campaign"]) {
      const { data, error } = await supabase.from("funnel_events").select(columns).eq("dedupe_key", key).maybeSingle();
      if (error && isUndefinedColumn(error)) continue;
      if (error) { console.error("Funnel checkout lookup failed", error.code); return null; }
      return (data as unknown as CheckoutOrigin | null) ?? null;
    }
  } catch (error) {
    console.error("Funnel checkout lookup failed", error instanceof Error ? error.name : "unknown error");
  }
  return null;
}

function originFirstTouch(origin: CheckoutOrigin | null): FirstTouch | null {
  return origin?.first_touch_source ? { source: origin.first_touch_source, medium: origin.first_touch_medium ?? null, campaign: origin.first_touch_campaign ?? null, landing: origin.first_touch_landing ?? null } : null;
}

function originTraffic(origin: CheckoutOrigin | null): Partial<TrafficFields> {
  return { device: (origin?.device as TrafficFields["device"] | null | undefined) ?? null, country: origin?.country ?? null };
}

/**
 * Records `paid` for a Checkout Session, copying the funnel session, variant, campaign, device and
 * country from the matching `checkout_created` event. Idempotent across webhook retries. Never throws.
 * Resolves true on the first delivery for this session, false on a repeat, null if unknown.
 */
export async function recordPaidEvent(supabase: SupabaseClient, checkoutSessionId: string): Promise<boolean | null> {
  const origin = await lookupCheckoutOrigin(supabase, checkoutSessionId);
  return recordFunnelEvent(supabase, {
    event: "paid",
    sessionId: origin?.session_id,
    variant: origin?.variant,
    utmCampaign: origin?.utm_campaign,
    ref: origin?.ref,
    traffic: originTraffic(origin),
    firstTouch: originFirstTouch(origin),
    dedupeKey: `paid:${checkoutSessionId}`
  });
}

/**
 * Stripe's own account of a checkout that did not pay (stripe_payment_failed / stripe_session_expired).
 * Linked to the funnel session through the checkout_created row; the key is the Stripe event id, so
 * webhook retries and re-deliveries insert once. checkoutSessionId may be null (a failed PaymentIntent
 * we could not map to a session): the row is still written, just unlinked. Never throws.
 */
export async function recordStripeCheckoutEvent(
  supabase: SupabaseClient,
  input: { event: "stripe_payment_failed" | "stripe_session_expired"; stripeEventId: string; checkoutSessionId: string | null; detail: CheckoutDetail }
): Promise<boolean | null> {
  const origin = input.checkoutSessionId ? await lookupCheckoutOrigin(supabase, input.checkoutSessionId) : null;
  return recordFunnelEvent(supabase, {
    event: input.event,
    sessionId: origin?.session_id,
    variant: origin?.variant,
    utmCampaign: origin?.utm_campaign,
    ref: origin?.ref,
    traffic: originTraffic(origin),
    detail: { ...input.detail, ...(input.checkoutSessionId ? { checkout_id: input.checkoutSessionId } : {}) },
    dedupeKey: input.stripeEventId
  });
}

/**
 * Keeps the last failure on the reservation (reservations.last_payment_error, nullable). Only touches
 * a reservation that has not been paid or refunded, so a late or replayed failure can never undo a
 * payment. Resolves true when a row was updated. Never throws; a missing column or reservation is quiet.
 */
export async function noteReservationFailure(supabase: SupabaseClient, checkoutSessionId: string, label: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("reservations").update({ last_payment_error: label.slice(0, 100) }).eq("stripe_checkout_session_id", checkoutSessionId).in("status", ["pending", "expired"]).select("id");
    if (error) { console.error("Reservation failure note failed", error.code); return false; }
    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error("Reservation failure note failed", error instanceof Error ? error.name : "unknown error");
    return false;
  }
}

// Postgres 42703 = undefined_column; PostgREST PGRST204 = column not in the schema cache. Lets the
// app run before the optional-column migrations (ref, traffic, detail) are applied.
function isUndefinedColumn(error: { code?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}
