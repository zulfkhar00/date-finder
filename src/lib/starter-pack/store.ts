// Storage contract for starter packs, plus an in-memory implementation used by the unit tests. The Supabase
// implementation (supabase-store.ts) follows the same rules. Both must keep: one row per (user, version), a lease so two
// workers never generate the same pack, and the daily caps counted from the runs ledger.
import { FAILED_RETRY_AFTER_MS, LEASE_MS, MAX_LIFETIME_ATTEMPTS, TERMINAL_ERRORS, decideRun, nextUtcDayStart, utcDay, type PackLimits } from "./limits";
import type { PackContent, PackRow, RunKind } from "./types";

export type ClaimDenied = "cap" | "regen_limit" | "busy" | "ready" | "not_due" | "user_gone";
export type ClaimResult = { ok: true; row: PackRow; runId: string } | { ok: false; reason: ClaimDenied };
export type ClaimInput = { userId: string; version: number; kind: RunKind; now: Date; limits: PackLimits };

export interface PackStore {
  /** Creates the row if missing (unique per user and version), applies the rules below, and leases it. */
  claim(input: ClaimInput): Promise<ClaimResult>;
  /** Adds spend (weighted tokens) to today's ledger row of this run. Called even when the run later fails. */
  addTokens(runId: string, tokens: number): Promise<void>;
  complete(row: PackRow, result: { content: PackContent; model: string; tries: number; now: Date }): Promise<void>;
  /** Releases the lease after a failed run. Keeps the old content when there is one (a failed regenerate). */
  fail(row: PackRow, result: { code: string; tries: number; now: Date }): Promise<void>;
  /** Users whose pack needs work: waiting and due, stuck generating past its lease, or failed long enough ago. */
  listDueUserIds(input: { version: number; now: Date; limit: number }): Promise<string[]>;
}

/**
 * The rules that need no I/O, shared by both stores: can this row be claimed by this kind of run right now?
 * `stale` means a generating row whose lease has run out (its worker died), which counts as pending.
 */
export function claimability(row: Pick<PackRow, "status" | "next_attempt_at" | "last_error" | "attempts" | "updated_at" | "lease_until">, kind: RunKind, now: Date): ClaimDenied | null {
  const stale = row.status === "generating" && row.lease_until !== null && Date.parse(row.lease_until) <= now.getTime();
  if (row.status === "generating" && !stale) return "busy";
  const status = stale ? "pending" : row.status;
  if (kind === "auto") {
    if (status === "ready") return "ready";
    if (status === "pending" && row.next_attempt_at && Date.parse(row.next_attempt_at) > now.getTime()) return "not_due";
    if (status === "failed") {
      const old = Date.parse(row.updated_at) <= now.getTime() - FAILED_RETRY_AFTER_MS;
      if (!old || row.attempts >= MAX_LIFETIME_ATTEMPTS || (row.last_error && TERMINAL_ERRORS.has(row.last_error))) return "not_due";
    }
  }
  return null;
}

export class MemoryPackStore implements PackStore {
  rows: PackRow[] = [];
  runs: { id: string; userId: string | null; day: string; kind: RunKind; tokens: number }[] = [];
  gone = new Set<string>();
  private seq = 0;

  async claim({ userId, version, kind, now, limits }: ClaimInput): Promise<ClaimResult> {
    if (this.gone.has(userId)) return { ok: false, reason: "user_gone" };
    let row = this.rows.find((r) => r.user_id === userId && r.version === version);
    if (!row) {
      row = { id: `p${++this.seq}`, user_id: userId, version, status: "pending", content: null, attempts: 0, last_error: null, tokens: 0, model: null, lease_until: null, next_attempt_at: null, generated_at: null, updated_at: now.toISOString() };
      this.rows.push(row);
    }
    const denied = claimability(row, kind, now);
    if (denied) return { ok: false, reason: denied };
    const day = utcDay(now);
    const today = this.runs.filter((r) => r.day === day);
    const cap = decideRun({ runsToday: today.length, tokensToday: today.reduce((s, r) => s + r.tokens, 0), userRegenerationsToday: today.filter((r) => r.userId === userId && r.kind === "regenerate").length }, kind, limits);
    if (cap) {
      if (cap === "cap" && row.status !== "ready") Object.assign(row, { status: "pending", next_attempt_at: nextUtcDayStart(now).toISOString(), last_error: "cap", lease_until: null, updated_at: now.toISOString() });
      return { ok: false, reason: cap };
    }
    row.status = "generating";
    row.lease_until = new Date(now.getTime() + LEASE_MS).toISOString();
    row.updated_at = now.toISOString();
    const runId = `r${++this.seq}`;
    this.runs.push({ id: runId, userId, day, kind, tokens: 0 });
    return { ok: true, row: { ...row }, runId };
  }

  async addTokens(runId: string, tokens: number) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) run.tokens += Math.max(0, tokens);
  }

  async complete(claimed: PackRow, { content, model, tries, now }: { content: PackContent; model: string; tries: number; now: Date }) {
    const row = this.rows.find((r) => r.id === claimed.id);
    if (!row) return;
    Object.assign(row, { status: "ready", content, model, attempts: claimed.attempts + tries, last_error: null, lease_until: null, next_attempt_at: null, generated_at: now.toISOString(), updated_at: now.toISOString() });
  }

  async fail(claimed: PackRow, { code, tries, now }: { code: string; tries: number; now: Date }) {
    const row = this.rows.find((r) => r.id === claimed.id);
    if (!row) return;
    Object.assign(row, { status: row.content ? "ready" : "failed", attempts: claimed.attempts + tries, last_error: code, lease_until: null, updated_at: now.toISOString() });
  }

  async listDueUserIds({ version, now, limit }: { version: number; now: Date; limit: number }) {
    return this.rows
      .filter((r) => r.version === version && !this.gone.has(r.user_id) && claimability(r, "auto", now) === null)
      .slice(0, limit).map((r) => r.user_id);
  }
}
