// Redacts personal data from telemetry payloads (Sentry events, PostHog events) before they leave
// the process. Emails are personal data; Stripe Checkout session ids are bearer tokens for the
// confirmation page, so neither may reach a third party.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CHECKOUT_SESSION = /\bcs_(?:test|live)_[A-Za-z0-9]+/g;
const MAX_DEPTH = 12;

export function scrubString(value: string): string {
  return value.replace(EMAIL, "[email]").replace(CHECKOUT_SESSION, "[checkout_session]");
}

export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubString(value) as T;
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1)) as T;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = scrubDeep(item, depth + 1);
  return out as T;
}
