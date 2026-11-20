import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { funnelAccount } from "@/lib/funnel-account";
import { recordFunnelEvent } from "@/lib/funnel";
import { loadInternalUserIds } from "@/lib/real-funnel";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Confirmed signups = accounts that confirmed their email for the FIRST time, counted from the
// signup_confirmed funnel event (one per account, dedupe key signup:<user id>). It is recorded by the
// two places a code or link is verified (onboarding's inline code step and the standalone /login, plus
// the emailed link) so every path counts once, and a repeat login never counts again.
// Separate from "Get started clicks": a click is intent, a confirmation is a real mailbox.
// External only: internal accounts (founder / test emails, profiles.internal) are dropped by the same
// classification the funnel uses. Rows before supabase/2026-11-21-funnel-account-link.sql do not exist,
// so counts start at `captureSince`; nothing is backfilled or guessed.

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 1000;
const MAX_ROWS = 50_000;

export type SignupEventRow = { created_at: string; user_id: string | null; account_internal: boolean | null };
export type SignupStats = {
  /** External first confirmations in the last 24 h / 30 d. */
  day: number;
  month: number;
  /** When confirmations started being recorded (ISO), or null when none has been recorded yet. */
  captureSince: string | null;
  /** Internal confirmations dropped from the 30 d window. */
  excludedInternal30d: number;
};

/** Records the first confirmation of an account. Never throws, never blocks sign-in, never stores the email. */
export async function recordFirstConfirmation(user: { id: string; email?: string | null }, supabase?: SupabaseClient): Promise<void> {
  try {
    const sb = supabase ?? getSupabaseAdmin();
    // Profiles are created on first sight after sign-in (ensureProfile), so "no profile yet" is the
    // moment of first confirmation. Unknown (query failed) records nothing: better a gap than a repeat login counted as new.
    const { data, error } = await sb.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || data) return;
    const account = funnelAccount(user.id, user.email);
    if (!account) return;
    await recordFunnelEvent(sb, { event: "signup_confirmed", account, dedupeKey: `signup:${account.userId}` });
  } catch {
    // analytics only
  }
}

/** The pure half: external first confirmations per window. One account counts once even if its row repeated. */
export function computeSignups(rows: SignupEventRow[], internalUserIds: ReadonlySet<string>, captureSince: string | null, now = new Date()): SignupStats {
  const dayStart = now.getTime() - DAY;
  const monthStart = now.getTime() - 30 * DAY;
  const seen = new Set<string>();
  let day = 0, month = 0, excludedInternal30d = 0;
  for (const row of rows) {
    const at = Date.parse(row.created_at);
    if (Number.isNaN(at) || at < monthStart || at > now.getTime()) continue;
    if (!row.user_id) continue; // no account on the row: cannot be told apart from noise, never counted
    const id = row.user_id.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    if (row.account_internal === true || internalUserIds.has(id)) { excludedInternal30d += 1; continue; }
    month += 1;
    if (at >= dayStart) day += 1;
  }
  return { day, month, captureSince, excludedInternal30d };
}

/** Throws when anything it needs cannot be read (including the migration being absent): callers show "n/a", never zero. */
export async function getConfirmedSignups(supabase: SupabaseClient, now = new Date()): Promise<SignupStats> {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const rows: SignupEventRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase.from("funnel_events").select("created_at, user_id, account_internal").eq("event", "signup_confirmed").gte("created_at", since)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      console.error("Signups query failed", "funnel_events", error.code ?? "unknown");
      throw new Error("Signups query failed: funnel_events");
    }
    rows.push(...((data ?? []) as SignupEventRow[]));
    if (!data || data.length < PAGE) break;
  }
  const first = await supabase.from("funnel_events").select("created_at").eq("event", "signup_confirmed").order("created_at", { ascending: true }).limit(1);
  if (first.error) {
    console.error("Signups query failed", "funnel_events_first", first.error.code ?? "unknown");
    throw new Error("Signups query failed: funnel_events");
  }
  const captureSince = ((first.data ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null;
  return computeSignups(rows, await loadInternalUserIds(supabase), captureSince, now);
}
