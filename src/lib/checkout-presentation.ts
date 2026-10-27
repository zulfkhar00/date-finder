import type Stripe from "stripe";

export type EmbeddedPayment = { mode: "embedded"; sessionId: string; clientSecret: string; publishableKey: string };
export type CheckoutResponse = EmbeddedPayment | { mode: "hosted"; url: string };

export function checkoutPresentation(requestedMode: unknown, publishableKey: string | undefined, siteUrl: string) {
  const returnUrl = `${siteUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
  if (requestedMode === "embedded" && publishableKey && /^pk_(live|test)_[A-Za-z0-9]+$/.test(publishableKey)) {
    return {
      mode: "embedded" as const,
      publishableKey,
      params: { ui_mode: "embedded_page", return_url: returnUrl, redirect_on_completion: "if_required" } satisfies Stripe.Checkout.SessionCreateParams
    };
  }
  // Cached clients still expect a hosted URL. Missing public configuration can also roll back safely.
  return {
    mode: "hosted" as const,
    params: { success_url: returnUrl, cancel_url: `${siteUrl}/reserve?cancelled=1` } satisfies Stripe.Checkout.SessionCreateParams
  };
}

export function checkoutResponse(session: Pick<Stripe.Checkout.Session, "id" | "url" | "client_secret">, presentation: ReturnType<typeof checkoutPresentation>): CheckoutResponse {
  if (presentation.mode === "embedded") {
    if (!session.client_secret) throw new Error("Stripe did not return an embedded checkout secret");
    return { mode: "embedded", sessionId: session.id, clientSecret: session.client_secret, publishableKey: presentation.publishableKey };
  }
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { mode: "hosted", url: session.url };
}

export function readCheckoutResponse(value: unknown): CheckoutResponse {
  if (!value || typeof value !== "object") throw new Error("Checkout could not open. Please try again.");
  const result = value as Record<string, unknown>;
  if (result.mode === "embedded" && typeof result.sessionId === "string" && /^cs_(live_|test_)[A-Za-z0-9]+$/.test(result.sessionId)
    && typeof result.clientSecret === "string" && result.clientSecret.startsWith(`${result.sessionId}_secret_`)
    && typeof result.publishableKey === "string" && /^pk_(live|test)_[A-Za-z0-9]+$/.test(result.publishableKey)) {
    return result as EmbeddedPayment;
  }
  // Support a new client served while the previous deployment is still handling API requests.
  if (typeof result.url === "string" && result.url.startsWith("https://")) return { mode: "hosted", url: result.url };
  throw new Error("Checkout could not open. Please try again.");
}
