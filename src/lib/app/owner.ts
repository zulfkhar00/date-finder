// Who may open the owner-only preview at /app. No "server-only" import so scripts/check-mock.ts can run it.
import { parseAdminEmails } from "@/lib/admin-config";

/** The founders' list (ADMIN_EMAILS, the same one that guards /admin), plus an optional OWNER_APP_EMAILS for /app only. */
export function ownerAllowlist(env: Record<string, string | undefined> = process.env): string {
  return [env.ADMIN_EMAILS, env.OWNER_APP_EMAILS].filter(Boolean).join(",");
}

/** Is this address on the list? Case-insensitive; an empty list matches nobody. */
export function isOwnerEmail(email: string | null | undefined, allowlist: string | undefined): boolean {
  return typeof email === "string" && parseAdminEmails(allowlist).has(email.trim().toLowerCase());
}

/**
 * True only for a signed-in app user whose confirmed email is on the list. Anyone else, signed in or not, gets false
 * and the caller answers with an ordinary 404.
 */
export function isOwner(user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined, allowlist: string | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return isOwnerEmail(user.email, allowlist);
}

export const MIN_PASSWORD_LENGTH = 12;
