import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { MemoryRunStore, type ClaimResult, type RunStore } from "./limits";

/** Postgres-backed store (supabase/2026-11-02-try-tool.sql). Counts survive restarts and are shared across instances. */
export class SupabaseRunStore implements RunStore {
  async claim({ ipHash, sessionHash, kind, limits }: Parameters<RunStore["claim"]>[0]): Promise<ClaimResult> {
    const { data, error } = await getSupabaseAdmin().rpc("try_claim_run", {
      p_ip_hash: ipHash,
      p_session_hash: sessionHash,
      p_kind: kind,
      p_session_limit: limits.sessionPerDay,
      p_ip_limit: limits.ipPerDay,
      p_daily_cap: limits.dailyCap
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error(`try_claim_run failed${error?.code ? ` (${error.code})` : ""}`);
    if (!row.allowed) return { allowed: false, reason: row.reason === "cap" ? "cap" : row.reason === "ip" ? "ip" : "session" };
    return { allowed: true, runId: String(row.run_id), sessionRemaining: Number(row.session_remaining) };
  }

  async release(runId: string): Promise<void> {
    await getSupabaseAdmin().rpc("try_release_run", { p_run_id: Number(runId) });
  }
}

/**
 * Uses Supabase, and falls back to per-process memory counters when the database or the migration is
 * unavailable, so the tool keeps working (with weaker, restart-resettable limits) instead of going dark.
 */
export class FallbackRunStore implements RunStore {
  private memory = new MemoryRunStore();
  private owners = new Map<string, "db" | "memory">();

  constructor(private primary: RunStore = new SupabaseRunStore(), private onFallback: (error: unknown) => void = () => undefined) {}

  async claim(input: Parameters<RunStore["claim"]>[0]): Promise<ClaimResult> {
    try {
      const result = await this.primary.claim(input);
      if (result.allowed) this.owners.set(result.runId, "db");
      return result;
    } catch (error) {
      this.onFallback(error);
      const result = await this.memory.claim(input);
      if (result.allowed) this.owners.set(result.runId, "memory");
      return result;
    }
  }

  async release(runId: string): Promise<void> {
    const owner = this.owners.get(runId);
    this.owners.delete(runId);
    if (owner === "memory") return this.memory.release(runId);
    try {
      await this.primary.release(runId);
    } catch {
      // A run that could not be released simply stays counted.
    }
  }
}

let shared: RunStore | null = null;
export function getRunStore(onFallback: (error: unknown) => void): RunStore {
  if (!shared) shared = new FallbackRunStore(new SupabaseRunStore(), onFallback);
  return shared;
}
