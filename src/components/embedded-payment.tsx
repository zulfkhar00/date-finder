"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/attribution-client";
import { cleanToken, type CloseReason } from "@/lib/checkout-events";
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

export function EmbeddedPayment({ payment, onBack, completeHref, onComplete, neutral }: { payment: Payment; onBack: () => void; completeHref?: string; onComplete?: () => void; neutral?: boolean }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "paying" | "error">("loading");
  // Checkout diagnostics (funnel events only; nothing here changes what the visitor sees or can do).
  const checkoutId = payment.sessionId;
  const startedAt = useRef<number | null>(null);
  const paid = useRef(false);
  const closeSent = useRef(false);
  const mounted = useRef(false);

  // checkout_closed: left without paying. pagehide and visibilitychange both fire (mobile Safari may
  // only deliver one of them), back / "Not now" and unmount cover in-app exits. Sent once, by beacon.
  useEffect(() => {
    mounted.current = true;
    startedAt.current ??= Date.now();
    const sendClosed = (reason: CloseReason) => {
      if (paid.current || closeSent.current) return;
      closeSent.current = true;
      const seconds = (Date.now() - (startedAt.current ?? Date.now())) / 1000;
      trackEvent("checkout_closed", { checkoutId, detail: { reason, seconds }, oncePerSession: true, beacon: true });
    };
    const onPageHide = () => sendClosed("pagehide");
    const onVisibility = () => { if (document.visibilityState === "hidden") sendClosed("hidden"); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      mounted.current = false;
      // Deferred so a Strict Mode remount (dev) or a quick re-render does not count as leaving.
      setTimeout(() => { if (!mounted.current) sendClosed("unmount"); }, 0);
    };
  }, [checkoutId]);
  const leave = () => {
    if (!paid.current && !closeSent.current) {
      closeSent.current = true;
      trackEvent("checkout_closed", { checkoutId, detail: { reason: "back", seconds: (Date.now() - (startedAt.current ?? Date.now())) / 1000 }, oncePerSession: true, beacon: true });
    }
    onBack();
  };

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
            paid.current = true;
            if (cancelled) return;
            if (onComplete) { onComplete(); return; }
            router.replace(completeHref ?? `/confirmation?session_id=${encodeURIComponent(payment.sessionId)}`);
          },
          onAnalyticsEvent: (event) => {
            if (cancelled) return;
            if (event.eventType === "checkoutSubmitted") {
              setState("paying");
              trackEvent("payment_submit", { checkoutId, oncePerSession: true, detail: { paymentMethod: event.details.paymentMethodType } });
            }
            if (event.eventType === "checkoutSubmitFailed") {
              setState("ready");
              // The embedded checkout only reports why the submit failed on this side (api_error,
              // user_cancelled, reverification, unexpected). Decline codes come from the webhook.
              trackEvent("payment_error", { checkoutId, oncePerSession: true, detail: { code: event.details.failureReason, type: "client", paymentMethod: event.details.paymentMethodType } });
            }
          }
        });
        if (cancelled || !container.current) { checkout.destroy(); return; }
        checkout.mount(container.current);
        setState("ready");
        trackEvent("checkout_form_ready", { checkoutId, oncePerSession: true });
      } catch (error) {
        if (!cancelled) {
          setState("error");
          // Only a short machine token (Stripe error code/type, or our own marker) leaves the browser, never the message.
          const stripeError = error as { code?: unknown; type?: unknown } | null;
          const code = cleanToken(stripeError?.code) ?? cleanToken(stripeError?.type) ?? (error instanceof Error && /stripe is unavailable|failed to load stripe/i.test(error.message) ? "stripe_js_unavailable" : "mount_failed");
          trackEvent("checkout_form_error", { checkoutId, oncePerSession: true, detail: { code, type: "load" } });
        }
      }
    }
    void mount();
    return () => { cancelled = true; checkout?.destroy(); };
  }, [payment, attempt, router, completeHref, onComplete, checkoutId]);

  return <section className="embedded-payment" aria-labelledby="payment-heading">
    {neutral ? <>
      <h2 id="payment-heading">Activate NoSwipe</h2>
      <p className="payment-note"><Lock size={16} aria-hidden="true" /> Secure payment by Stripe</p>
    </> : <>
      <h2 id="payment-heading">Reserve your spot.</h2>
      <p className="payment-note"><Lock size={16} aria-hidden="true" /> Secure payment · $1.00 once</p>
      <p className="review-details">Refundable early-access waitlist fee. Payment reserves a spot; it does not start a service.</p>
    </>}
    {state === "loading" && <p role="status" className="payment-loading"><span className="spinner" aria-hidden="true" /> Loading secure payment…</p>}
    <div ref={container} className="payment-frame" />
    {state === "error" && <div className="form-error" role="alert">
      <p>Secure payment couldn’t load. Retry this checkout, or check its payment status before starting again.</p>
      <button type="button" className="form-back" onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>Retry payment</button>
    </div>}
    <div className="form-actions">
      <button type="button" className="form-back" disabled={state === "loading" || state === "paying"} onClick={leave}>{neutral ? "Not now" : "Back to your answers"}</button>
      {neutral ? null : <Link className="form-back" href={`/confirmation?session_id=${encodeURIComponent(payment.sessionId)}`}>Check payment status</Link>}
    </div>
  </section>;
}
