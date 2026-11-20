import { NextResponse } from "next/server";
import { attributionSchema, sessionIdSchema, type Attribution } from "@/lib/attribution";
import { recordFunnelEvent } from "@/lib/funnel";
import { errorMessage, notifyOps, notifyOpsError } from "@/lib/ops-notify";
import { datingAppLabels, onboardingSchema, reservationSchema, type Onboarding } from "@/lib/reservation";
import { getStripe, getSiteUrl } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { internalEmailReason } from "@/lib/internal-traffic";
import { trafficFromRequest } from "@/lib/traffic";
import { reuseOpenCheckout } from "@/lib/checkout-reuse";
import { CHECKOUT_LINE_ITEM, checkoutPresentation, checkoutResponse } from "@/lib/checkout-presentation";

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
  } catch (error) {
    notifyOpsError("POST /api/checkout 503", errorMessage(error));
    return NextResponse.json({ error: "Reservations are temporarily unavailable. Please try again later." }, { status: 503 });
  }

  // Attribution is best-effort: invalid or missing values never block checkout.
  const record = (payload ?? {}) as Record<string, unknown>;
  const presentation = checkoutPresentation(record.checkoutMode, process.env.STRIPE_PUBLISHABLE_KEY, siteUrl);
  const attributionResult = attributionSchema.safeParse(record.attribution ?? {});
  const attribution: Attribution | null = attributionResult.success ? attributionResult.data : null;
  const sessionIdResult = sessionIdSchema.safeParse(record.funnelSessionId);
  const funnelSessionId = sessionIdResult.success ? sessionIdResult.data : null;

  // Onboarding answers: absent is fine (older cached form); present but invalid is a 400.
  let onboarding: Onboarding | null = null;
  if (record.onboarding !== undefined) {
    const onboardingResult = onboardingSchema.safeParse(record.onboarding);
    if (!onboardingResult.success) return NextResponse.json({ error: "Please check your answers and try again." }, { status: 400 });
    onboarding = onboardingResult.data;
  }

  const input = parsed.data;

  // Back-button, double-tap or a return visit: hand back the same open session instead of a second reservation.
  const reuse = await reuseOpenCheckout({
    findPending: async (email, since) => {
      const { data, error } = await supabase.from("reservations").select("id, stripe_checkout_session_id, created_at").eq("email", email).eq("status", "pending").not("stripe_checkout_session_id", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    retrieve: (sessionId) => stripe.checkout.sessions.retrieve(sessionId),
    markExpired: async (id) => { await supabase.from("reservations").update({ status: "expired" }).eq("id", id).eq("status", "pending"); },
    respond: (session) => checkoutResponse(session, presentation)
  }, input.email);
  if (reuse.kind === "reuse") return NextResponse.json(reuse.response, { headers: { "Cache-Control": "no-store" } });
  if (reuse.kind === "paid") return NextResponse.json({ error: "Your payment already went through. Refresh the page to see it." }, { status: 409 });

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
  // Optional columns may not exist yet (migration not applied). Try the full row first, then drop
  // the newest optional columns one group at a time. Only undefined-column errors are retried;
  // anything else (constraint, network, auth) falls through to the 500 below.
  // Newest first: `ref` (2026-10-28), then `onboarding`, then the UTM columns.
  const withOnboarding = onboarding ? { onboarding } : {};
  const rows = [
    { ...baseRow, ...attributionColumns(attribution), ...refColumn(attribution), ...withOnboarding },
    ...(attribution?.ref ? [{ ...baseRow, ...attributionColumns(attribution), ...withOnboarding }] : []),
    ...(onboarding ? [{ ...baseRow, ...attributionColumns(attribution) }] : []),
    ...(attribution ? [baseRow] : [])
  ];
  let { data: reservation, error: insertError } = await supabase.from("reservations").insert(rows[0]).select("id").single();
  for (const row of rows.slice(1)) {
    if (!insertError || !isUndefinedColumnError(insertError)) break;
    console.error("Reservation insert failed on an optional column; retrying without it", insertError.code);
    ({ data: reservation, error: insertError } = await supabase.from("reservations").insert(row).select("id").single());
  }

  if (insertError || !reservation) {
    console.error("Reservation insert failed", insertError?.code);
    notifyOpsError("POST /api/checkout 500", `reservation insert failed ${insertError?.code ?? ""}`.trim());
    return NextResponse.json({ error: "We couldn't save your reservation. Please try again." }, { status: 500 });
  }

  // Test addresses (example.test, *test*@) never ping the founders' group.
  if (!internalEmailReason(input.email)) notifyOps("signups", signupText(input.city, input.email, onboarding));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      managed_payments: { enabled: false },
      payment_method_types: ["card"],
      customer_email: input.email,
      client_reference_id: reservation.id,
      metadata: { reservation_id: reservation.id },
      line_items: [{ price_data: { currency: "usd", unit_amount: 100, product_data: { name: CHECKOUT_LINE_ITEM.name, description: CHECKOUT_LINE_ITEM.description } }, quantity: 1 }],
      ...presentation.params
    }, { idempotencyKey: `morrow-reservation-${reservation.id}` });

    let response;
    try {
      response = checkoutResponse(session, presentation);
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw error;
    }
    const { data: updated, error: updateError } = await supabase.from("reservations").update({ stripe_checkout_session_id: session.id }).eq("id", reservation.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError || !updated) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw updateError ?? new Error("Reservation was not attached to checkout");
    }
    await recordFunnelEvent(supabase, { event: "checkout_created", sessionId: funnelSessionId, variant: attribution?.variant, utmCampaign: attribution?.utm_campaign, ref: attribution?.ref,
      // Country (geo header) and device (UA) of the person opening checkout, so drop-offs can be split by them.
      traffic: (({ device, country }) => ({ device, country }))(trafficFromRequest({}, request.headers)),
      dedupeKey: `checkout_created:${session.id}` });
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Checkout creation failed", error instanceof Error ? error.message : "unknown error");
    notifyOpsError("POST /api/checkout 502", `checkout creation failed: ${errorMessage(error)}`);
    await supabase.from("reservations").update({ status: "expired" }).eq("id", reservation.id).eq("status", "pending");
    return NextResponse.json({ error: "Checkout could not open. You have not been charged. Please try again." }, { status: 502 });
  }
}

// Signup alert for the founders' group: first name, city, apps, age range, full email.
function signupText(city: string, email: string, onboarding: Onboarding | null): string {
  const lines = [`📝 New signup: ${(onboarding?.name.split(/\s+/)[0] || "(no name)")}, ${city}`];
  if (onboarding) {
    lines.push(`Apps: ${onboarding.apps.map((app) => datingAppLabels[app]).join(", ") || "none yet"}`);
    lines.push(`Age ${onboarding.age ?? "not given"}, looking for ${onboarding.ageMin}–${onboarding.ageMax}`);
  }
  lines.push(email);
  return lines.join("\n");
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

function refColumn(attribution: Attribution | null) {
  return attribution?.ref ? { ref: attribution.ref } : {};
}

// Postgres 42703 = undefined_column; PostgREST PGRST204 = column not found in the schema cache.
function isUndefinedColumnError(error: { code?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}
