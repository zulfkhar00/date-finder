import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const idSchema = z.uuid();

async function completeSession(session: Stripe.Checkout.Session) {
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
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
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
        if (session.payment_status === "paid") await completeSession(session);
        break;
      }
      case "checkout.session.async_payment_succeeded":
        await completeSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { error } = await getSupabaseAdmin().from("reservations").update({ status: "expired" }).eq("stripe_checkout_session_id", session.id).eq("status", "pending");
        if (error) throw error;
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === "string" && charge.amount_refunded >= charge.amount) {
          const { error } = await getSupabaseAdmin().from("reservations").update({ status: "refunded" }).eq("stripe_payment_intent_id", charge.payment_intent).eq("status", "paid");
          if (error) throw error;
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed", event.id, error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
