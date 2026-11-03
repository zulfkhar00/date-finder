import { createHmac } from "node:crypto";

// Abuse and cost guard for /api/try. Pure logic plus an in-memory store; the Supabase-backed store
// lives in store.ts. Identifiers are HMAC-hashed with a server salt and the UTC day, so a stored
// hash cannot be reversed to an IP and cannot be linked across days. No raw IPs are ever stored.

/**
 * `dailyCap` counts runs (a released run does not count). `tokenCap` is a hard spend ceiling in
 * input-token equivalents (input + 5 x output, roughly cost-proportional) that releasing a run never
 * gives back, so failures that did cost money still burn the budget.
 */
export type TryLimits = { sessionPerDay: number; ipPerDay: number; dailyCap: number; tokenCap: number };

export const DEFAULT_LIMITS: TryLimits = { sessionPerDay: 3, ipPerDay: 6, dailyCap: 300, tokenCap: 8_000_000 };

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLimits(env: Record<string, string | undefined> = process.env): TryLimits {
  return {
    sessionPerDay: positiveInt(env.TRY_SESSION_DAILY_LIMIT, DEFAULT_LIMITS.sessionPerDay),
    ipPerDay: positiveInt(env.TRY_IP_DAILY_LIMIT, DEFAULT_LIMITS.ipPerDay),
    dailyCap: positiveInt(env.TRY_DAILY_CAP, DEFAULT_LIMITS.dailyCap),
    tokenCap: positiveInt(env.TRY_DAILY_TOKEN_CAP, DEFAULT_LIMITS.tokenCap)
  };
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function hashIdentifier(value: string, salt: string, day: string): string {
  return createHmac("sha256", salt).update(`${day}:${value}`).digest("hex").slice(0, 32);
}

export type ClaimDenial = "session" | "ip" | "cap";
export type ClaimResult =
  | { allowed: true; runId: string; sessionRemaining: number }
  | { allowed: false; reason: ClaimDenial };

/** Pure decision used by the in-memory store; the SQL function try_claim_run mirrors it. */
export function decideClaim(used: { session: number; ip: number; daily: number; tokens?: number }, limits: TryLimits): ClaimDenial | null {
  if (used.session >= limits.sessionPerDay) return "session";
  if (used.ip >= limits.ipPerDay) return "ip";
  if (used.daily >= limits.dailyCap) return "cap";
  if ((used.tokens ?? 0) >= limits.tokenCap) return "cap";
  return null;
}

export interface RunStore {
  claim(input: { ipHash: string; sessionHash: string; kind: string; day: string; limits: TryLimits }): Promise<ClaimResult>;
  /** Gives the run back because the model never ran, so it does not count against the visitor or the run cap. Spend is never given back. */
  release(runId: string): Promise<void>;
  /** Adds the spend of a run that reached the model (input-token equivalents). */
  recordUsage(runId: string, tokens: number): Promise<void>;
}

/** Cost-proportional token weight: output tokens cost about 5x input. */
export function weightedTokens(inputTokens: number, outputTokens: number): number {
  return Math.max(0, Math.round(inputTokens + 5 * outputTokens));
}

/** Zeroes the last 64 bits of an IPv6 address (keep the /64 a home connection owns); IPv4 passes through. */
export function ipKey(address: string): string {
  const raw = address.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!raw.includes(":")) return raw;
  const mapped = raw.match(/^(?:::ffff:|::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  let groups: string[];
  if (raw.includes("::")) {
    const [head, tail] = raw.split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  } else {
    groups = raw.split(":");
  }
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return raw;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

type MemoryRow = { id: string; day: string; ipHash: string; sessionHash: string; released: boolean; tokens: number };

export class MemoryRunStore implements RunStore {
  private rows: MemoryRow[] = [];
  private seq = 0;

  async claim({ ipHash, sessionHash, day, limits }: { ipHash: string; sessionHash: string; kind: string; day: string; limits: TryLimits }): Promise<ClaimResult> {
    this.rows = this.rows.filter((row) => row.day === day);
    const live = this.rows.filter((row) => !row.released);
    const used = {
      session: live.filter((row) => row.sessionHash === sessionHash).length,
      ip: live.filter((row) => row.ipHash === ipHash).length,
      daily: live.length,
      tokens: this.rows.reduce((sum, row) => sum + row.tokens, 0)
    };
    const denied = decideClaim(used, limits);
    if (denied) return { allowed: false, reason: denied };
    this.seq += 1;
    const id = `m${this.seq}`;
    this.rows.push({ id, day, ipHash, sessionHash, released: false, tokens: 0 });
    return { allowed: true, runId: id, sessionRemaining: limits.sessionPerDay - used.session - 1 };
  }

  async release(runId: string): Promise<void> {
    const row = this.rows.find((item) => item.id === runId);
    if (row) row.released = true;
  }

  async recordUsage(runId: string, tokens: number): Promise<void> {
    const row = this.rows.find((item) => item.id === runId);
    if (row) row.tokens += tokens;
  }
}
