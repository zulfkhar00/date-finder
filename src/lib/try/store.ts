import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ClaimResult, RunStore } from "./limits";

/**
 * Postgres-backed store (supabase/2026-11-02-try-tool.sql). Counts are shared across every serverless
 * instance and survive restarts. If the database or the migration is unavailable, claim() throws and
 * /api/try answers "temporarily unavailable": the cost guard fails closed, never falls back to
 * per-instance memory.
 */
export class SupabaseRunStore implements RunStore {
  async claim({ ipHash, sessionHash, kind, limits }: Parameters<RunStore["claim"]>[0]): Promise<ClaimResult> {
    const { data, error } = await getSupabaseAdmin().rpc("try_claim_run", {
      p_ip_hash: ipHash,
      p_session_hash: sessionHash,
      p_kind: kind,
      p_session_limit: limits.sessionPerDay,
      p_ip_limit: limits.ipPerDay,
      p_daily_cap: limits.dailyCap,
      p_token_cap: limits.tokenCap
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error(`try_claim_run failed${error?.code ? ` (${error.code})` : ""}`);
    if (!row.allowed) return { allowed: false, reason: row.reason === "cap" ? "cap" : row.reason === "ip" ? "ip" : "session" };
    return { allowed: true, runId: String(row.run_id), sessionRemaining: Number(row.session_remaining) };
  }

  async release(runId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("try_release_run", { p_run_id: Number(runId) });
    if (error) throw new Error(`try_release_run failed (${error.code ?? "unknown"})`);
  }

  async recordUsage(runId: string, tokens: number): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("try_record_usage", { p_run_id: Number(runId), p_tokens: tokens });
    if (error) throw new Error(`try_record_usage failed (${error.code ?? "unknown"})`);
  }
}

let shared: RunStore | null = null;
export function getRunStore(): RunStore {
  if (!shared) shared = new SupabaseRunStore();
  return shared;
}
