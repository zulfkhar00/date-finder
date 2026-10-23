import { z } from "zod";

// Shared by the browser capture code and the server routes. Values are first-party only and
// never include personal data: UTM values that look like an email are dropped, and the
// referrer is reduced to its origin.

export const DEFAULT_VARIANT = "premium";
export const VARIANT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const UTM_MAX = 200;
export const REFERRER_MAX = 255;

export const CLIENT_EVENTS = ["page_view", "reserve_start", "checkout_canceled"] as const;
export const SERVER_EVENTS = ["checkout_created", "paid"] as const;
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

const optionalUtm = z.unknown().optional().transform(cleanUtm);

export const attributionSchema = z.object({
  utm_source: optionalUtm,
  utm_medium: optionalUtm,
  utm_campaign: optionalUtm,
  utm_content: optionalUtm,
  utm_term: optionalUtm,
  variant: z.unknown().optional().transform(cleanVariant),
  referrer: z.unknown().optional().transform(cleanReferrer)
});

export type Attribution = z.infer<typeof attributionSchema>;

export const sessionIdSchema = z.uuid();

export const clientEventSchema = z.object({
  sessionId: sessionIdSchema,
  event: z.enum(CLIENT_EVENTS),
  variant: z.unknown().optional().transform(cleanVariant),
  utmCampaign: optionalUtm
});
