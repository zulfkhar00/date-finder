// Spend and rate limits for the starter pack. Pure, so the cap logic is unit-tested (scripts/check-starter-pack.ts).
// Same idea as the old /try tool: a daily run cap plus a daily token cap that a released run never gives back.
// This is a SEPARATE budget (STARTER_PACK_*), so a busy pack day cannot starve anything else, and the reverse.

/**
 * dailyCap counts model runs started today (UTC). tokenCap is a spend ceiling in input-token equivalents
 * (input + 5 x output, roughly cost-proportional). regeneratePerUser is the per-user limit on the Regenerate button.
 */
export type PackLimits = { dailyCap: number; tokenCap: number; regeneratePerUser: number };

// A pack is roughly 3k tokens in, 2.5k out, plus up to 6 photos (~1.6k each): about 25k weighted. 60 runs/day and
// 2.5M weighted tokens keep a worst-case day near $15 while leaving room for ~100 packs on a normal one.
export const DEFAULT_LIMITS: PackLimits = { dailyCap: 60, tokenCap: 2_500_000, regeneratePerUser: 3 };
export const MAX_TRIES_PER_RUN = 3;
/** Lifetime tries before the sweep stops retrying a failed pack on its own (an admin can still retrigger). */
export const MAX_LIFETIME_ATTEMPTS = 9;
export const FAILED_RETRY_AFTER_MS = 60 * 60 * 1000;
export const LEASE_MS = 4 * 60 * 1000;
/** Errors the sweep does not retry on its own: it would only repeat. */
export const TERMINAL_ERRORS = new Set(["refusal", "user_gone", "unsafe_input"]);

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLimits(env: Record<string, string | undefined> = process.env): PackLimits {
  return {
    dailyCap: positiveInt(env.STARTER_PACK_DAILY_CAP, DEFAULT_LIMITS.dailyCap),
    tokenCap: positiveInt(env.STARTER_PACK_DAILY_TOKEN_CAP, DEFAULT_LIMITS.tokenCap),
    regeneratePerUser: positiveInt(env.STARTER_PACK_REGENERATE_PER_DAY, DEFAULT_LIMITS.regeneratePerUser)
  };
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
/** 00:05 UTC tomorrow: when a capped pack is tried again. */
export function nextUtcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
}

/** Cost-proportional token weight: output tokens cost about 5x input. */
export function weightedTokens(inputTokens: number, outputTokens: number): number {
  return Math.max(0, Math.round(inputTokens + 5 * outputTokens));
}

export type Denial = "cap" | "regen_limit";
/** Pure decision shared by the Supabase and in-memory stores. */
export function decideRun(used: { runsToday: number; tokensToday: number; userRegenerationsToday: number }, kind: "auto" | "regenerate" | "admin", limits: PackLimits): Denial | null {
  if (used.runsToday >= limits.dailyCap || used.tokensToday >= limits.tokenCap) return "cap";
  if (kind === "regenerate" && used.userRegenerationsToday >= limits.regeneratePerUser) return "regen_limit";
  return null;
}

/** Wait before try number `attempt` (1-based failed attempts so far): 2s, then 6s. */
export function backoffMs(failedAttempts: number): number {
  return failedAttempts <= 1 ? 2000 : 6000;
}
