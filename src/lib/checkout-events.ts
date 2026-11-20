// Checkout diagnostics: the events that explain why an opened checkout does not turn into a payment.
// Pure helpers (no I/O, no "server-only") shared by the browser, /api/event, the Stripe webhook, the
// admin report and the tests.
//
// Privacy: only short machine tokens are ever kept: a Stripe error code, a decline code, a card brand,
// a card country, a funding type, a payment method type and a number of seconds. Never a card number,
// name, email, address, message text or Stripe object id other than the Checkout Session id.

/** Sent by the browser from the embedded payment component. */
export const CHECKOUT_CLIENT_EVENTS = ["checkout_form_ready", "checkout_form_error", "payment_submit", "payment_error", "checkout_closed"] as const;
/** Written by the Stripe webhook (server truth). */
export const STRIPE_SERVER_EVENTS = ["stripe_payment_failed", "stripe_session_expired"] as const;
export type CheckoutClientEvent = (typeof CHECKOUT_CLIENT_EVENTS)[number];
export type StripeServerEvent = (typeof STRIPE_SERVER_EVENTS)[number];

/** Events that only feed the admin Checkout panel; the visitor and funnel models ignore them. */
export const CHECKOUT_DIAGNOSTIC_EVENTS: ReadonlySet<string> = new Set<string>([...CHECKOUT_CLIENT_EVENTS, ...STRIPE_SERVER_EVENTS]);

export const CHECKOUT_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/;
export const CLOSE_REASONS = ["hidden", "pagehide", "back", "unmount"] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

const TOKEN_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const MAX_SECONDS = 24 * 60 * 60;

/** A short lowercase machine token (error code, brand, ...) or undefined. Anything else is dropped. */
export function cleanToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const lowered = value.trim().toLowerCase();
  return TOKEN_PATTERN.test(lowered) ? lowered : undefined;
}

export function cleanCountry(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase();
  return COUNTRY_PATTERN.test(upper) && upper !== "XX" ? upper : undefined;
}

export function cleanCheckoutId(value: unknown): string | undefined {
  return typeof value === "string" && CHECKOUT_ID_PATTERN.test(value) ? value : undefined;
}

export function cleanSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(MAX_SECONDS, Math.max(0, Math.round(value)));
}

/** What a failed payment looks like once reduced. Snake case = how it is stored in funnel_events.detail. */
export type CheckoutDetail = {
  checkout_id?: string;
  code?: string;
  decline_code?: string;
  type?: string;
  payment_method?: string;
  card_brand?: string;
  card_country?: string;
  funding?: string;
  reason?: string;
  seconds?: number;
  /** Stripe test mode: such rows are kept but never counted as real. */
  test?: true;
};

function compact(detail: CheckoutDetail): CheckoutDetail {
  return Object.fromEntries(Object.entries(detail).filter(([, v]) => v !== undefined)) as CheckoutDetail;
}

/**
 * Reduces whatever the browser sent to the whitelisted fields. Unknown keys and malformed values are
 * dropped, never stored. The browser can only describe its own view (no decline codes: the embedded
 * checkout does not expose them), so that is all this accepts.
 */
export function cleanClientDetail(value: unknown, checkoutId: string | undefined): CheckoutDetail {
  const input = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const reason = typeof input.reason === "string" && (CLOSE_REASONS as readonly string[]).includes(input.reason) ? input.reason : undefined;
  return compact({
    checkout_id: checkoutId,
    code: cleanToken(input.code),
    type: cleanToken(input.type),
    payment_method: cleanToken(input.paymentMethod),
    reason,
    seconds: cleanSeconds(input.seconds)
  });
}

/** Idempotency key for a browser checkout event: once per Checkout Session per step (payment_error: per distinct code). */
export function clientDedupeKey(event: CheckoutClientEvent, checkoutId: string, detail: CheckoutDetail): string {
  return event === "payment_error" ? `${event}:${checkoutId}:${detail.code ?? "unknown"}` : `${event}:${checkoutId}`;
}

/** The Checkout Session id inside any dedupe key that carries one (`checkout_created:cs_...`, `payment_error:cs_...:code`). */
export function checkoutIdFromKey(key: string | null | undefined): string | null {
  const match = key?.match(/cs_(?:test|live)_[A-Za-z0-9]+/);
  return match ? match[0] : null;
}

// ---------- Stripe -> detail mapping (webhook) ----------

type StripeCard = { brand?: string | null; country?: string | null; funding?: string | null } | null | undefined;
export type PaymentIntentFailureLike = {
  last_payment_error?: {
    code?: string | null;
    decline_code?: string | null;
    type?: string | null;
    payment_method?: { type?: string | null; card?: StripeCard } | null;
    payment_method_details?: { type?: string | null; card?: StripeCard } | null;
  } | null;
};

/** code / decline_code / error type / card brand, country, funding from a failed PaymentIntent. No ids, no card numbers. */
export function paymentFailureDetail(intent: PaymentIntentFailureLike, livemode: boolean, checkoutId?: string | null): CheckoutDetail {
  const error = intent.last_payment_error;
  const method = error?.payment_method ?? error?.payment_method_details;
  const card = method?.card;
  return compact({
    checkout_id: checkoutId ?? undefined,
    code: cleanToken(error?.code) ?? "unknown",
    decline_code: cleanToken(error?.decline_code),
    type: cleanToken(error?.type),
    payment_method: cleanToken(method?.type),
    card_brand: cleanToken(card?.brand),
    card_country: cleanCountry(card?.country),
    funding: cleanToken(card?.funding),
    test: livemode ? undefined : true
  });
}

/** Detail for checkout.session.expired / async_payment_failed. `seconds` = how long the session lived. */
export function sessionEndDetail(kind: "expired" | "async_payment_failed", checkoutId: string, livemode: boolean, lifetimeSeconds?: number): CheckoutDetail {
  return compact({
    checkout_id: cleanCheckoutId(checkoutId),
    code: kind === "async_payment_failed" ? "async_payment_failed" : undefined,
    seconds: cleanSeconds(lifetimeSeconds),
    test: livemode ? undefined : true
  });
}

/** "card_declined / do_not_honor" style label, also what is kept on the reservation. */
export function failureLabel(detail: Pick<CheckoutDetail, "code" | "decline_code">): string {
  const code = detail.code ?? "unknown";
  return detail.decline_code ? `${code} / ${detail.decline_code}` : code;
}
