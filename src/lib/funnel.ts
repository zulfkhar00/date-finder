import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelEventName } from "@/lib/attribution";

type FunnelEvent = {
  event: FunnelEventName;
  sessionId?: string | null;
  variant?: string | null;
  utmCampaign?: string | null;
  /** When set, a repeated insert with the same key is ignored (e.g. Stripe webhook retries). */
  dedupeKey?: string;
};

/**
 * Records a funnel event. Never throws: if the funnel_events table is missing or the insert
 * fails, it logs the error code only and returns, so checkout and webhooks keep working.
 */
export async function recordFunnelEvent(supabase: SupabaseClient, input: FunnelEvent): Promise<void> {
  try {
    const row = {
      event: input.event,
      session_id: input.sessionId ?? null,
      variant: input.variant ?? null,
      utm_campaign: input.utmCampaign ?? null,
      dedupe_key: input.dedupeKey ?? null
    };
    const { error } = input.dedupeKey
      ? await supabase.from("funnel_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
      : await supabase.from("funnel_events").insert(row);
    if (error) console.error("Funnel event insert failed", input.event, error.code);
  } catch (error) {
    console.error("Funnel event insert failed", input.event, error instanceof Error ? error.name : "unknown error");
  }
}

/**
 * Records `paid` for a Checkout Session, copying the funnel session, variant and campaign from
 * the matching `checkout_created` event. Idempotent across webhook retries. Never throws.
 */
export async function recordPaidEvent(supabase: SupabaseClient, checkoutSessionId: string): Promise<void> {
  let origin: { session_id: string | null; variant: string | null; utm_campaign: string | null } | null = null;
  try {
    const { data, error } = await supabase.from("funnel_events").select("session_id, variant, utm_campaign").eq("dedupe_key", `checkout_created:${checkoutSessionId}`).maybeSingle();
    if (error) console.error("Funnel checkout lookup failed", error.code);
    else origin = data;
  } catch (error) {
    console.error("Funnel checkout lookup failed", error instanceof Error ? error.name : "unknown error");
  }
  await recordFunnelEvent(supabase, {
    event: "paid",
    sessionId: origin?.session_id,
    variant: origin?.variant,
    utmCampaign: origin?.utm_campaign,
    dedupeKey: `paid:${checkoutSessionId}`
  });
}
