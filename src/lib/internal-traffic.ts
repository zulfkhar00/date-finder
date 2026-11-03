// What counts as internal or test traffic. Used by the daily digest and the admin funnel so the
// numbers the founders look at only contain real visitors and real payments. Pure functions, no I/O.

/** Founders. Zulya's address is from the repo's git authors and her first test payment (cs_test_). */
const FOUNDER_EMAILS = ["meyrlansuirkhanov@gmail.com", "olxzulfar@gmail.com"];

/** Funnel session ids of our own probes (UUIDs starting 00000000-); never a real browser tab. */
export const PROBE_SESSION_PREFIX = "00000000-";

/** Hosts a real visitor can reach production on. Anything else (localhost, previews) is not recorded. */
export const PRODUCTION_HOSTS = ["noswipe.app", "www.noswipe.app", "morrow.zulfkhar.dev"];

function gmailCanonical(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split("@");
  if (!local || !domain) return email.toLowerCase().trim();
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return `${local}@${domain}`;
}

function extraInternalEmails(): string[] {
  return (process.env.INTERNAL_EMAILS ?? "").split(",").map((value) => value.trim()).filter(Boolean).map(gmailCanonical);
}

/** Why a reservation email is not a real customer, or null when it looks real. */
export function internalEmailReason(email: string): "founder" | "test_email" | null {
  const canonical = gmailCanonical(email);
  if (FOUNDER_EMAILS.map(gmailCanonical).includes(canonical) || extraInternalEmails().includes(canonical)) return "founder";
  const [local = "", domain = ""] = email.toLowerCase().trim().split("@");
  if (/test/.test(local) || /(^|\.)(example|test|invalid|localhost)(\.|$)/.test(domain)) return "test_email";
  if (/^\d+$/.test(local)) return "test_email"; // 123@gmail.com style junk
  return null;
}

/** Stripe test-mode Checkout Sessions start with cs_test_. */
export function isStripeTestSession(sessionId: string | null | undefined): boolean {
  return !!sessionId && sessionId.startsWith("cs_test_");
}

export type ReservationLike = { email: string; stripe_checkout_session_id: string | null };

export function reservationExclusion(row: ReservationLike): "founder" | "test_email" | "stripe_test" | null {
  if (isStripeTestSession(row.stripe_checkout_session_id)) return "stripe_test";
  return internalEmailReason(row.email);
}

/** True when an event request came from localhost, a preview deployment, or any non-production host. */
export function isNonProductionOrigin(origin: string | null, extraHost?: string): boolean {
  if (!origin) return false; // server-to-server and curl have no Origin; browsers always send it on POST
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return true;
  }
  const allowed = new Set(PRODUCTION_HOSTS);
  if (extraHost) allowed.add(extraHost);
  return !allowed.has(host);
}
