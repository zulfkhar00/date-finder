import "server-only";
import { HOUR_MS } from "@/lib/fulfilment/core";
import type { CopyContext } from "@/lib/app/status-copy";
import { isStripeTestSession } from "@/lib/internal-traffic";
import { getHoldNotice } from "@/lib/reports/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * What Home needs to tell the truth about each app: has the client paid, is a report hold on the account, and how long have
 * they waited. An unreadable payment state counts as paid (the same rule as the Activate card: never push a second payment,
 * never tell a paying client they have not started). No contents are logged.
 */
export async function getClientFulfilment(user: { id: string; email?: string | null }, onboardingDoneAt: string | null, now: Date = new Date()): Promise<CopyContext> {
  const email = user.email?.toLowerCase();
  let paid = true;
  let paidAt: string | null = null;
  if (email) {
    const { data, error } = await getSupabaseAdmin().from("reservations").select("status, paid_at, stripe_checkout_session_id").eq("email", email).eq("status", "paid");
    if (!error) {
      const real = (data ?? []).filter((r) => !isStripeTestSession(r.stripe_checkout_session_id as string | null));
      paid = real.length > 0;
      paidAt = real.map((r) => r.paid_at as string | null).filter(Boolean).sort().at(-1) ?? null;
    }
  }
  const hold = await getHoldNotice(user.id).then((h) => h?.hold ?? null).catch(() => null);
  const starts = [onboardingDoneAt, paid ? paidAt : null].filter((v): v is string => !!v).map((v) => Date.parse(v)).filter(Number.isFinite);
  const since = starts.length ? Math.max(...starts) : null;
  return { paid, hold, hoursWaiting: since === null ? null : Math.max(0, Math.floor((now.getTime() - since) / HOUR_MS)) };
}
