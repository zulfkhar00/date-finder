"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmbeddedPayment as Payment } from "@/lib/checkout-presentation";

const stripeClients = new Map<string, Promise<Stripe | null>>();
function stripeClient(key: string) {
  let client = stripeClients.get(key);
  if (!client) {
    client = loadStripe(key).catch((error: unknown) => { stripeClients.delete(key); throw error; });
    stripeClients.set(key, client);
  }
  return client;
}

export function EmbeddedPayment({ payment, onBack }: { payment: Payment; onBack: () => void }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "paying" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let checkout: StripeEmbeddedCheckout | undefined;
    async function mount() {
      try {
        const stripe = await stripeClient(payment.publishableKey);
        if (cancelled) return;
        if (!stripe) throw new Error("Stripe is unavailable");
        checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret: payment.clientSecret,
          onComplete: () => {
            if (!cancelled) router.replace(`/confirmation?session_id=${encodeURIComponent(payment.sessionId)}`);
          },
          onAnalyticsEvent: (event) => {
            if (cancelled) return;
            if (event.eventType === "checkoutSubmitted") setState("paying");
            if (event.eventType === "checkoutSubmitFailed") setState("ready");
          }
        });
        if (cancelled || !container.current) { checkout.destroy(); return; }
        checkout.mount(container.current);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void mount();
    return () => { cancelled = true; checkout?.destroy(); };
  }, [payment, attempt, router]);

  return <section className="embedded-payment" aria-labelledby="payment-heading">
    <h2 id="payment-heading">Reserve your spot.</h2>
    <p className="payment-note"><Lock size={16} aria-hidden="true" /> Secure payment · $1.00 once</p>
    <p className="review-details">Refundable. Activates your NoSwipe setup.</p>
    {state === "loading" && <p role="status" className="payment-loading"><span className="spinner" aria-hidden="true" /> Loading secure payment…</p>}
    <div ref={container} className="payment-frame" />
    {state === "error" && <div className="form-error" role="alert">
      <p>Secure payment couldn’t load. Retry this checkout, or check its payment status before starting again.</p>
      <button type="button" className="form-back" onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>Retry payment</button>
    </div>}
    <div className="form-actions">
      <button type="button" className="form-back" disabled={state === "loading" || state === "paying"} onClick={onBack}>Back to your answers</button>
      <Link className="form-back" href={`/confirmation?session_id=${encodeURIComponent(payment.sessionId)}`}>Check payment status</Link>
    </div>
  </section>;
}
