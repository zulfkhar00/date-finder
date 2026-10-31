import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelEventName } from "@/lib/attribution";

type FunnelEvent = {
  event: FunnelEventName;
  sessionId?: string | null;
  variant?: string | null;
  utmCampaign?: string | null;
  ref?: string | null;
  /** When set, a repeated insert with the same key is ignored (e.g. Stripe webhook retries). */
  dedupeKey?: string;
};

/**
 * Records a funnel event. Never throws: if the funnel_events table is missing or the insert
 * fails, it logs the error code only and returns, so checkout and webhooks keep working.
 * With a dedupeKey, resolves true if this call inserted the row, false if it already existed,
 * and null when unknown (insert failed). Without one, resolves null.
 */
export async function recordFunnelEvent(supabase: SupabaseClient, input: FunnelEvent): Promise<boolean | null> {
  try {
    const row = {
      event: input.event,
      session_id: input.sessionId ?? null,
      variant: input.variant ?? null,
      utm_campaign: input.utmCampaign ?? null,
      dedupe_key: input.dedupeKey ?? null,
      // Only sent when set, so rows without a ref still insert before the migration adds the column.
      ...(input.ref ? { ref: input.ref } : {})
    };
    if (input.dedupeKey) {
      let { data, error } = await supabase.from("funnel_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
      if (error && input.ref && isUndefinedColumn(error)) ({ data, error } = await supabase.from("funnel_events").upsert(withoutRef(row), { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id"));
      if (error) {
        console.error("Funnel event insert failed", input.event, error.code);
        return null;
      }
      return (data?.length ?? 0) > 0;
    }
    let { error } = await supabase.from("funnel_events").insert(row);
    if (error && input.ref && isUndefinedColumn(error)) ({ error } = await supabase.from("funnel_events").insert(withoutRef(row)));
    if (error) console.error("Funnel event insert failed", input.event, error.code);
  } catch (error) {
    console.error("Funnel event insert failed", input.event, error instanceof Error ? error.name : "unknown error");
  }
  return null;
}

/**
 * Insert for browser events. Unlike recordFunnelEvent it reports failure (Postgres/PostgREST error
 * code, e.g. 23514 when funnel_events_event_check predates get_started/onboarding_complete) so
 * /api/event can answer 503 instead of a silent 204. Never throws, never logs row contents.
 */
export async function insertClientFunnelEvent(supabase: SupabaseClient, input: FunnelEvent): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const row = {
      event: input.event,
      session_id: input.sessionId ?? null,
      variant: input.variant ?? null,
      utm_campaign: input.utmCampaign ?? null,
      ...(input.ref ? { ref: input.ref } : {})
    };
    let { error } = await supabase.from("funnel_events").insert(row);
    if (error && input.ref && isUndefinedColumn(error)) ({ error } = await supabase.from("funnel_events").insert(withoutRef(row)));
    if (error) {
      console.error("Funnel event insert failed", input.event, error.code);
      return { ok: false, code: error.code || "unknown" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Funnel event insert failed", input.event, error instanceof Error ? error.name : "unknown error");
    return { ok: false, code: "exception" };
  }
}

/**
 * Records `paid` for a Checkout Session, copying the funnel session, variant and campaign from
 * the matching `checkout_created` event. Idempotent across webhook retries. Never throws.
 * Resolves true on the first delivery for this session, false on a repeat, null if unknown.
 */
export async function recordPaidEvent(supabase: SupabaseClient, checkoutSessionId: string): Promise<boolean | null> {
  let origin: { session_id: string | null; variant: string | null; utm_campaign: string | null; ref?: string | null } | null = null;
  try {
    const key = `checkout_created:${checkoutSessionId}`;
    let { data, error } = await supabase.from("funnel_events").select("session_id, variant, utm_campaign, ref").eq("dedupe_key", key).maybeSingle();
    if (error && isUndefinedColumn(error)) ({ data, error } = await supabase.from("funnel_events").select("session_id, variant, utm_campaign").eq("dedupe_key", key).maybeSingle());
    if (error) console.error("Funnel checkout lookup failed", error.code);
    else origin = data;
  } catch (error) {
    console.error("Funnel checkout lookup failed", error instanceof Error ? error.name : "unknown error");
  }
  return recordFunnelEvent(supabase, {
    event: "paid",
    sessionId: origin?.session_id,
    variant: origin?.variant,
    utmCampaign: origin?.utm_campaign,
    ref: origin?.ref,
    dedupeKey: `paid:${checkoutSessionId}`
  });
}

// Postgres 42703 = undefined_column; PostgREST PGRST204 = column not in the schema cache. Lets the
// app run before supabase/2026-10-28-funnel-ref.sql adds the `ref` column.
function isUndefinedColumn(error: { code?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

function withoutRef<T extends { ref?: unknown }>(row: T): Omit<T, "ref"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ref, ...rest } = row;
  return rest;
}
