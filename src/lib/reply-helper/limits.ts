// Spend and rate limits for the Reply helper. Pure, so the cap logic is unit-tested (scripts/check-reply-helper.ts).
// A SEPARATE budget from the starter pack (REPLY_HELPER_*): a busy reply day cannot starve packs, and the reverse.
// Same accounting idea: a daily run cap plus a token cap, and a run that fails is never given back.

export type ReplyLimits = { dailyCap: number; tokenCap: number; perUserPerDay: number };

// A run is ~2k tokens of prompt, up to 4 screenshots (~1.6k each) and ~700 out: ~12k weighted with images, ~5k without.
// 150 runs/day and 2.5M weighted tokens keep a worst-case day near $15 (about the starter pack's ceiling).
export const DEFAULT_LIMITS: ReplyLimits = { dailyCap: 150, tokenCap: 2_500_000, perUserPerDay: 20 };
export const MAX_TRIES_PER_RUN = 3;
/** Total wall-clock budget for one run: Vercel Hobby stops a function at 60 s. A retry only starts if its whole call can still fit. */
export const RUN_BUDGET_MS = 56_000;
export const CALL_TIMEOUT_MS = 28_000;
/** A run that started and has not finished is "in flight" for this long (a double submit while it runs is refused). */
export const IN_FLIGHT_MS = 75_000;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLimits(env: Record<string, string | undefined> = process.env): ReplyLimits {
  return {
    dailyCap: positiveInt(env.REPLY_HELPER_DAILY_CAP, DEFAULT_LIMITS.dailyCap),
    tokenCap: positiveInt(env.REPLY_HELPER_DAILY_TOKEN_CAP, DEFAULT_LIMITS.tokenCap),
    perUserPerDay: positiveInt(env.REPLY_HELPER_PER_USER_PER_DAY, DEFAULT_LIMITS.perUserPerDay)
  };
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function weightedTokens(inputTokens: number, outputTokens: number): number {
  return Math.max(0, Math.round(inputTokens + 5 * outputTokens));
}

export type Denial = "cap" | "user_limit" | "busy";
export type Usage = { runsToday: number; tokensToday: number; userRunsToday: number; userInFlight: boolean };

/** Pure decision shared by the Supabase and in-memory stores. In flight wins (it is a double submit, not a limit). */
export function decideRun(used: Usage, limits: ReplyLimits): Denial | null {
  if (used.userInFlight) return "busy";
  if (used.userRunsToday >= limits.perUserPerDay) return "user_limit";
  if (used.runsToday >= limits.dailyCap || used.tokensToday >= limits.tokenCap) return "cap";
  return null;
}

/** Wait before try number n+1 (n failed tries so far): 1.5 s, then 4 s. */
export function backoffMs(failedTries: number): number {
  return failedTries <= 1 ? 1500 : 4000;
}
