import { NextResponse } from "next/server";
import { attributionSchema, sessionIdSchema, type Attribution } from "@/lib/attribution";
import { recordFunnelEvent } from "@/lib/funnel";
import { reservationSchema } from "@/lib/reservation";
import { getStripe, getSiteUrl } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 8192) return NextResponse.json({ error: "The form is too large." }, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Please check your answers and try again." }, { status: 400 });
  }

  const parsed = reservationSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Please complete every required question." }, { status: 400 });

  let stripe, supabase, siteUrl;
  try {
    stripe = getStripe(); supabase = getSupabaseAdmin(); siteUrl = getSiteUrl();
  } catch {
    return NextResponse.json({ error: "Reservations are temporarily unavailable. Please try again later." }, { status: 503 });
  }

  // Attribution is best-effort: invalid or missing values never block checkout.
  const record = (payload ?? {}) as Record<string, unknown>;
  const attributionResult = attributionSchema.safeParse(record.attribution ?? {});
  const attribution: Attribution | null = attributionResult.success ? attributionResult.data : null;
  const sessionIdResult = sessionIdSchema.safeParse(record.funnelSessionId);
  const funnelSessionId = sessionIdResult.success ? sessionIdResult.data : null;

  const input = parsed.data;
  const baseRow = {
    email: input.email,
    city: input.city,
    dating_preference: input.datingPreference,
    relationship_goal: input.relationshipGoal,
    date_frequency: input.dateFrequency,
    age_confirmed_at: new Date().toISOString(),
    terms_accepted_at: new Date().toISOString(),
    status: "pending"
  };
  let { data: reservation, error: insertError } = await supabase.from("reservations").insert({ ...baseRow, ...attributionColumns(attribution) }).select("id").single();
  if (insertError && attribution) {
    // The attribution columns may not exist yet (migration not applied); retry without them.
    console.error("Reservation insert with attribution failed; retrying without", insertError.code);
    ({ data: reservation, error: insertError } = await supabase.from("reservations").insert(baseRow).select("id").single());
  }

  if (insertError || !reservation) {
    console.error("Reservation insert failed", insertError?.code);
    return NextResponse.json({ error: "We couldn't save your reservation. Please try again." }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      managed_payments: { enabled: false },
      payment_method_types: ["card"],
      customer_email: input.email,
      client_reference_id: reservation.id,
      metadata: { reservation_id: reservation.id },
      line_items: [{ price_data: { currency: "usd", unit_amount: 100, product_data: { name: "Morrow early-access waitlist reservation", description: "One-time, nonrefundable waitlist fee, except where law requires. Concierge service is separate." } }, quantity: 1 }],
      success_url: `${siteUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/reserve?cancelled=1`
    }, { idempotencyKey: `morrow-reservation-${reservation.id}` });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    const { data: updated, error: updateError } = await supabase.from("reservations").update({ stripe_checkout_session_id: session.id }).eq("id", reservation.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError || !updated) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw updateError ?? new Error("Reservation was not attached to checkout");
    }
    await recordFunnelEvent(supabase, { event: "checkout_created", sessionId: funnelSessionId, variant: attribution?.variant, utmCampaign: attribution?.utm_campaign, dedupeKey: `checkout_created:${session.id}` });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout creation failed", error instanceof Error ? error.message : "unknown error");
    await supabase.from("reservations").update({ status: "expired" }).eq("id", reservation.id).eq("status", "pending");
    return NextResponse.json({ error: "Checkout could not open. You have not been charged. Please try again." }, { status: 502 });
  }
}

function attributionColumns(attribution: Attribution | null) {
  if (!attribution) return {};
  return {
    utm_source: attribution.utm_source ?? null,
    utm_medium: attribution.utm_medium ?? null,
    utm_campaign: attribution.utm_campaign ?? null,
    utm_content: attribution.utm_content ?? null,
    utm_term: attribution.utm_term ?? null,
    variant: attribution.variant,
    referrer: attribution.referrer ?? null
  };
}
