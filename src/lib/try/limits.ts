import { createHmac } from "node:crypto";

// Abuse and cost guard for /api/try. Pure logic plus an in-memory store; the Supabase-backed store
// lives in store.ts. Identifiers are HMAC-hashed with a server salt and the UTC day, so a stored
// hash cannot be reversed to an IP and cannot be linked across days. No raw IPs are ever stored.

export type TryLimits = { sessionPerDay: number; ipPerDay: number; dailyCap: number };

export const DEFAULT_LIMITS: TryLimits = { sessionPerDay: 3, ipPerDay: 6, dailyCap: 300 };

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLimits(env: Record<string, string | undefined> = process.env): TryLimits {
  return {
    sessionPerDay: positiveInt(env.TRY_SESSION_DAILY_LIMIT, DEFAULT_LIMITS.sessionPerDay),
    ipPerDay: positiveInt(env.TRY_IP_DAILY_LIMIT, DEFAULT_LIMITS.ipPerDay),
    dailyCap: positiveInt(env.TRY_DAILY_CAP, DEFAULT_LIMITS.dailyCap)
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
export function decideClaim(used: { session: number; ip: number; daily: number }, limits: TryLimits): ClaimDenial | null {
  if (used.session >= limits.sessionPerDay) return "session";
  if (used.ip >= limits.ipPerDay) return "ip";
  if (used.daily >= limits.dailyCap) return "cap";
  return null;
}

export interface RunStore {
  claim(input: { ipHash: string; sessionHash: string; kind: string; day: string; limits: TryLimits }): Promise<ClaimResult>;
  /** Gives the run back (our side failed), so it does not count against the visitor or the cap. */
  release(runId: string): Promise<void>;
}

type MemoryRow = { id: string; day: string; ipHash: string; sessionHash: string; released: boolean };

export class MemoryRunStore implements RunStore {
  private rows: MemoryRow[] = [];
  private seq = 0;

  async claim({ ipHash, sessionHash, day, limits }: { ipHash: string; sessionHash: string; kind: string; day: string; limits: TryLimits }): Promise<ClaimResult> {
    this.rows = this.rows.filter((row) => row.day === day);
    const live = this.rows.filter((row) => !row.released);
    const used = {
      session: live.filter((row) => row.sessionHash === sessionHash).length,
      ip: live.filter((row) => row.ipHash === ipHash).length,
      daily: live.length
    };
    const denied = decideClaim(used, limits);
    if (denied) return { allowed: false, reason: denied };
    this.seq += 1;
    const id = `m${this.seq}`;
    this.rows.push({ id, day, ipHash, sessionHash, released: false });
    return { allowed: true, runId: id, sessionRemaining: limits.sessionPerDay - used.session - 1 };
  }

  async release(runId: string): Promise<void> {
    const row = this.rows.find((item) => item.id === runId);
    if (row) row.released = true;
  }
}
