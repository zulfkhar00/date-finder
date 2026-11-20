import { z } from "zod";
import { CHECKOUT_CLIENT_EVENTS, cleanCheckoutId, cleanClientDetail } from "@/lib/checkout-events";

// Shared by the browser capture code and the server routes. Values are first-party only and
// never include personal data: UTM values that look like an email are dropped, and the
// referrer is reduced to its origin.

export const DEFAULT_VARIANT = "noswipe";
export const VARIANT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const UTM_MAX = 200;
export const REFERRER_MAX = 255;
// `ref` = the IG reel id (or any short source tag) in links like noswipe.app/?ref=DAbc123.
export const REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// One event per onboarding screen shown (once per tab session). ob_code_sent = email entered; the rest are screen names.
// reserve_start = basics shown, reserve_step_2 = email screen shown, reserve_step_3 = signed in, onboarding_complete = consent given.
export const ONBOARDING_STEP_EVENTS = ["ob_code_sent", "ob_apps", "ob_about", "ob_type", "ob_photos", "ob_consent", "ob_pay"] as const;
export const CLIENT_EVENTS = ["page_view", "get_started", "reserve_start", "reserve_step_2", "reserve_step_3", "onboarding_complete", "checkout_canceled", "resume_card_view", "resume_card_click", "checkout_blocked_country", ...ONBOARDING_STEP_EVENTS, ...CHECKOUT_CLIENT_EVENTS] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];
export const SERVER_EVENTS = ["checkout_created", "paid", "stripe_payment_failed", "stripe_session_expired", "paid_country_review"] as const;
export type FunnelEventName = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

export function cleanUtm(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, UTM_MAX);
  if (!cleaned || cleaned.includes("@")) return undefined;
  return cleaned;
}

export function cleanVariant(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_VARIANT;
  const lowered = value.trim().toLowerCase();
  return VARIANT_PATTERN.test(lowered) ? lowered : DEFAULT_VARIANT;
}

export function cleanReferrer(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin.slice(0, REFERRER_MAX);
  } catch {
    return undefined;
  }
}

export function cleanRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return REF_PATTERN.test(trimmed) ? trimmed : undefined;
}

const optionalUtm = z.unknown().optional().transform(cleanUtm);
const optionalRef = z.unknown().optional().transform(cleanRef);

export const attributionSchema = z.object({
  utm_source: optionalUtm,
  utm_medium: optionalUtm,
  utm_campaign: optionalUtm,
  utm_content: optionalUtm,
  utm_term: optionalUtm,
  variant: z.unknown().optional().transform(cleanVariant),
  referrer: z.unknown().optional().transform(cleanReferrer),
  ref: optionalRef
});

export type Attribution = z.infer<typeof attributionSchema>;

export const sessionIdSchema = z.uuid();

const checkoutEventSet: ReadonlySet<string> = new Set(CHECKOUT_CLIENT_EVENTS);

export const clientEventSchema = z.object({
  sessionId: sessionIdSchema,
  event: z.enum(CLIENT_EVENTS),
  variant: z.unknown().optional().transform(cleanVariant),
  utmCampaign: optionalUtm,
  ref: optionalRef,
  // Traffic capture. The browser sends raw hints; the server reduces them (referrer to a host,
  // landing to a path) before anything is stored. See src/lib/traffic.ts.
  utmSource: optionalUtm,
  utmMedium: optionalUtm,
  utmContent: optionalUtm,
  referrer: z.string().max(512).optional().catch(undefined),
  landingPath: z.string().max(200).optional().catch(undefined),
  // Checkout diagnostics (src/lib/checkout-events.ts): the Stripe Checkout Session id and a
  // whitelisted detail object. Required for the checkout_* / payment_* events, ignored for the rest.
  checkoutId: z.unknown().optional().transform(cleanCheckoutId),
  detail: z.unknown().optional()
}).superRefine((value, ctx) => {
  if (checkoutEventSet.has(value.event) && !value.checkoutId) ctx.addIssue({ code: "custom", message: "checkoutId required", path: ["checkoutId"] });
}).transform((value) => ({ ...value, detail: cleanClientDetail(value.detail, value.checkoutId) }));
