import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupCheckoutOrigin, recordFunnelEvent } from "@/lib/funnel";
import { paidCountries, reviewForPaid, type CountryReview } from "@/lib/paid-countries";

// Paid-country control, webhook half. A payment from outside PAID_COUNTRIES is never refunded or blocked by code:
// the reservation is marked for a person to look at (reservations.country_review, nullable, additive) and a
// funnel event is written. Instrumentation only: it never throws, so it cannot turn a paid webhook into a 500
// and a Stripe retry. Logs codes only, never an address, name or email.

type SessionLike = { id: string; customer_details?: { address?: { country?: string | null } | null } | null };

export type CountryReviewResult = { review: CountryReview | null; billing: string | null; marked: boolean };

export async function reviewPaidCountry(supabase: SupabaseClient, reservationId: string, session: SessionLike, opts: { list?: readonly string[] } = {}): Promise<CountryReviewResult> {
  const list = opts.list ?? paidCountries();
  const rawBilling = session.customer_details?.address?.country?.trim().toUpperCase() ?? null;
  const billing = rawBilling && /^[A-Z]{2}$/.test(rawBilling) ? rawBilling : null;
  try {
    // Sessions opened before billing address was required carry none: fall back to the geo country seen at checkout.
    const origin = billing ? null : await lookupCheckoutOrigin(supabase, session.id);
    const review = reviewForPaid({ billing, geo: origin?.country, list });
    if (!review) return { review: null, billing, marked: false };

    let marked = false;
    const update = await supabase.from("reservations").update({ country_review: review, billing_country: billing }).eq("id", reservationId).eq("status", "paid").select("id");
    if (update.error) console.error("Country review mark failed", update.error.code);
    else marked = (update.data?.length ?? 0) > 0;

    await recordFunnelEvent(supabase, {
      event: "paid_country_review",
      sessionId: origin?.session_id,
      variant: origin?.variant,
      utmCampaign: origin?.utm_campaign,
      ref: origin?.ref,
      detail: { checkout_id: session.id, reason: review, ...(billing ? { billing_country: billing } : {}) },
      dedupeKey: `paid_country_review:${session.id}`
    });
    return { review, billing, marked };
  } catch (error) {
    console.error("Country review failed", error instanceof Error ? error.name : "unknown error");
    return { review: null, billing, marked: false };
  }
}
