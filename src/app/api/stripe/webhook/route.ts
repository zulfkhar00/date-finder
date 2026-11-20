import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { sendReservationConfirmation } from "@/lib/email";
import { failureLabel, paymentFailureDetail, sessionEndDetail } from "@/lib/checkout-events";
import { noteReservationFailure, recordPaidEvent, recordStripeCheckoutEvent } from "@/lib/funnel";
import { errorMessage, notifyOps, notifyOpsError } from "@/lib/ops-notify";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const idSchema = z.uuid();

async function completeSession(session: Stripe.Checkout.Session, event: Stripe.Event) {
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.amount_total !== 100 || session.currency !== "usd") {
    throw new Error("Unexpected checkout payment state or amount");
  }
  const id = idSchema.safeParse(session.metadata?.reservation_id);
  if (!id.success || session.client_reference_id !== id.data || typeof session.payment_intent !== "string") {
    throw new Error("Checkout reservation reference is invalid");
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("finalize_reservation", {
    p_reservation_id: id.data,
    p_session_id: session.id,
    p_payment_intent_id: session.payment_intent
  });
  if (error) throw error;
  const firstDelivery = await recordPaidEvent(supabase, session.id);
  // Retries of an already-paid session (firstDelivery false) stay quiet; unknown (null) still posts.
  if (firstDelivery !== false) notifyOps("payments", await paidText(supabase, id.data, session, event), event.id);
  // Last step, and never throws: an email failure must not turn this into a 500 and a Stripe retry.
  await sendReservationConfirmation(supabase, id.data, firstDelivery);
}

/**
 * Diagnostics from Stripe for a checkout that did not pay. Instrumentation only: it never throws, so a
 * problem here cannot turn into a 500 and a Stripe retry storm, and it never changes a reservation's
 * status. Idempotent: the funnel row is keyed by the Stripe event id.
 */
async function recordCheckoutDiagnostics(event: Stripe.Event): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const asyncFailed = event.type === "checkout.session.async_payment_failed";
      const detail = sessionEndDetail(asyncFailed ? "async_payment_failed" : "expired", session.id, event.livemode, event.created - session.created);
      await recordStripeCheckoutEvent(supabase, { event: asyncFailed ? "stripe_payment_failed" : "stripe_session_expired", stripeEventId: event.id, checkoutSessionId: session.id, detail });
      if (asyncFailed) await noteReservationFailure(supabase, session.id, failureLabel(detail));
      return;
    }
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      // A PaymentIntent opened by Checkout does not carry our reservation; ask Stripe which session owns it.
      let checkoutId: string | null = null;
      try {
        const owner = await getStripe().checkout.sessions.list({ payment_intent: intent.id, limit: 1 });
        checkoutId = owner.data[0]?.id ?? null;
      } catch {
        // unlinked: the failure is still recorded, just without its session
      }
      const detail = paymentFailureDetail(intent, event.livemode, checkoutId);
      await recordStripeCheckoutEvent(supabase, { event: "stripe_payment_failed", stripeEventId: event.id, checkoutSessionId: checkoutId, detail });
      if (checkoutId) await noteReservationFailure(supabase, checkoutId, failureLabel(detail));
    }
  } catch (error) {
    console.error("Checkout diagnostics failed", event.id, error instanceof Error ? error.name : "unknown error");
  }
}

function modeTag(event: Stripe.Event): string {
  return event.livemode ? "" : " (test)";
}

async function paidText(supabase: ReturnType<typeof getSupabaseAdmin>, reservationId: string, session: Stripe.Checkout.Session, event: Stripe.Event): Promise<string> {
  let who = "";
  try {
    const { data } = await supabase.from("reservations").select("city, onboarding").eq("id", reservationId).maybeSingle();
    const name = typeof data?.onboarding?.name === "string" ? data.onboarding.name.split(/\s+/)[0] : null;
    if (data) who = [name, data.city].filter(Boolean).join(", ");
  } catch {
    // name and city are optional in the alert
  }
  const email = session.customer_details?.email ?? session.customer_email;
  return [`💵 $1 reserve paid${modeTag(event)}`, who, email ?? ""].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret) notifyOpsError("POST /api/stripe/webhook", "STRIPE_WEBHOOK_SECRET is not set; payments are not being recorded");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook unavailable" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") await completeSession(session, event);
        break;
      }
      case "checkout.session.async_payment_succeeded":
        await completeSession(event.data.object as Stripe.Checkout.Session, event);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { data, error } = await getSupabaseAdmin().from("reservations").update({ status: "expired" }).eq("stripe_checkout_session_id", session.id).eq("status", "pending").select("id");
        if (error) throw error;
        // Abandoned checkouts (expired) are normal and stay quiet; a failed payment is worth a line.
        if (event.type === "checkout.session.async_payment_failed" && data?.length) {
          const email = session.customer_details?.email ?? session.customer_email;
          notifyOps("payments", [`❌ Payment failed${modeTag(event)}`, email ?? ""].filter(Boolean).join("\n"), event.id);
        }
        await recordCheckoutDiagnostics(event);
        break;
      }
      case "payment_intent.payment_failed":
        await recordCheckoutDiagnostics(event);
        break;
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === "string" && charge.amount_refunded >= charge.amount) {
          const { data, error } = await getSupabaseAdmin().from("reservations").update({ status: "refunded" }).eq("stripe_payment_intent_id", charge.payment_intent).eq("status", "paid").select("id");
          if (error) throw error;
          // Only the first paid -> refunded transition posts, so Stripe retries stay quiet.
          if (data?.length) {
            const email = charge.billing_details?.email ?? charge.receipt_email;
            notifyOps("payments", [`↩️ Refund $${(charge.amount_refunded / 100).toFixed(2)}${modeTag(event)}`, email ?? ""].filter(Boolean).join("\n"), event.id);
          }
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed", event.id, error instanceof Error ? error.message : "unknown error");
    notifyOpsError("POST /api/stripe/webhook 500", `${event.type}: ${errorMessage(error)}`);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
