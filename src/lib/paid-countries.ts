// Where the paid service is offered. One module, no I/O, no "server-only": the API routes, the webhook, the
// server components that pick which screen to render, and the unit tests all import it.
//
// The free tools (sign-up, the starter pack, the demo) work everywhere. Only checkout is gated.
import { countryFromHeaders } from "@/lib/traffic";

export const DEFAULT_PAID_COUNTRIES = ["US", "CA", "GB", "AU", "NZ"] as const;

/** Shown wherever checkout would have been offered to someone outside the list. */
export const COUNTRY_BLOCKED_COPY = "NoSwipe’s paid service isn’t available in your country yet. Your free starter pack still works.";
/** The 403 body code of /api/checkout, so the browser can show COUNTRY_BLOCKED_COPY instead of a generic error. */
export const COUNTRY_BLOCKED_CODE = "country_not_supported";

/**
 * PAID_COUNTRIES parsed: comma or space separated ISO 3166-1 alpha-2 codes, case-insensitive. Anything that is not
 * two letters is dropped; if nothing valid is left (unset, empty, typo) the default list applies, so a bad env value
 * can never open the service worldwide by accident.
 */
export function parsePaidCountries(raw: string | undefined | null): readonly string[] {
  const codes = (raw ?? "").split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  return codes.length > 0 ? [...new Set(codes)] : DEFAULT_PAID_COUNTRIES;
}

export function paidCountries(env: string | undefined = process.env.PAID_COUNTRIES): readonly string[] {
  return parsePaidCountries(env);
}

/** True when this country code (any case, padded) is in the list. Unknown or malformed codes are never listed. */
export function isPaidCountry(code: string | null | undefined, list: readonly string[] = paidCountries()): boolean {
  const upper = typeof code === "string" ? code.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(upper) && list.includes(upper);
}

/**
 * The visitor's country from the host's geo header. x-vercel-ip-country is set by Vercel's edge and overwritten if a
 * client sends it, so it wins; cf-ipcountry (via the shared funnel helper) is only a fallback, because without
 * Cloudflare in front a client could send that one itself.
 */
export function geoCountry(headers: { get(name: string): string | null }): string | null {
  const vercel = countryFromHeaders({ get: (name) => (name === "x-vercel-ip-country" ? headers.get(name) : null) });
  return vercel ?? countryFromHeaders(headers);
}

export type PaidReason = "listed" | "override" | "dev_no_geo" | "no_geo" | "unsupported";
export type PaidDecision = { allowed: boolean; reason: PaidReason; country: string | null };

/**
 * Can this visitor open checkout? A listed country, or an admin override, passes. A missing geo header passes only
 * outside production (local dev has no proxy); in production no country means no checkout, because a gate that opens
 * when the header is missing is not a gate.
 */
export function decidePaid(input: { country: string | null; production: boolean; override?: boolean; list?: readonly string[] }): PaidDecision {
  const country = input.country;
  if (input.override) return { allowed: true, reason: "override", country };
  if (!country) return input.production ? { allowed: false, reason: "no_geo", country } : { allowed: true, reason: "dev_no_geo", country };
  return isPaidCountry(country, input.list) ? { allowed: true, reason: "listed", country } : { allowed: false, reason: "unsupported", country };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export type CountryReview = "billing_country_outside_list" | "geo_country_outside_list" | "country_unknown";

/**
 * What to do with a paid Checkout Session once Stripe confirms it. The billing address is authoritative (a VPN can
 * fake the IP country, not the card's billing country). Returns a review reason, or null when the country is fine.
 * Never a refund: a person decides.
 */
export function reviewForPaid(input: { billing: string | null | undefined; geo: string | null | undefined; list?: readonly string[] }): CountryReview | null {
  const billing = input.billing?.trim().toUpperCase();
  if (billing && /^[A-Z]{2}$/.test(billing)) return isPaidCountry(billing, input.list) ? null : "billing_country_outside_list";
  const geo = input.geo?.trim().toUpperCase();
  if (geo && /^[A-Z]{2}$/.test(geo)) return isPaidCountry(geo, input.list) ? null : "geo_country_outside_list";
  return "country_unknown";
}
