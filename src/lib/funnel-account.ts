import { internalEmailReason } from "@/lib/internal-traffic";

// Who is behind a browser event, decided by the server from the sign-in cookie and nothing else:
// never from an IP address, a device, a user agent or anything the browser sends in the body.
// The email is read only to classify it (lib/internal-traffic) and is dropped; only the account id
// and an internal flag are stored (supabase/2026-11-21-funnel-account-link.sql).

export type FunnelAccount = { userId: string; internal: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Classification of an account for the funnel: internal when its email is a founder / test address. */
export function funnelAccount(userId: string | null | undefined, email: string | null | undefined): FunnelAccount | null {
  if (!userId || !UUID.test(userId)) return null;
  return { userId: userId.toLowerCase(), internal: email ? internalEmailReason(email) !== null : false };
}
