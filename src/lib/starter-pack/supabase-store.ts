import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LEASE_MS, decideRun, nextUtcDayStart, utcDay } from "./limits";
import { claimability, type ClaimInput, type ClaimResult, type PackStore } from "./store";
import type { PackContent, PackRow } from "./types";

// Postgres-backed store (supabase/2026-11-20-starter-packs.sql). All access is the service role. Errors are
// thrown as short coded messages, never with row contents. The lease is a compare-and-swap on status, so two
// workers racing for the same row cannot both win it; the unique (user_id, version) index makes a double trigger a no-op.

const COLUMNS = "id, user_id, version, status, content, attempts, last_error, tokens, model, lease_until, next_attempt_at, generated_at, updated_at";

export class SupabasePackStore implements PackStore {
  private get sb() { return getSupabaseAdmin(); }

  async claim({ userId, version, kind, now, limits }: ClaimInput): Promise<ClaimResult> {
    const sb = this.sb;
    const nowIso = now.toISOString();
    const ins = await sb.from("starter_packs").upsert({ user_id: userId, version }, { onConflict: "user_id,version", ignoreDuplicates: true });
    if (ins.error) {
      if (ins.error.code === "23503") return { ok: false, reason: "user_gone" }; // the account was deleted
      throw new Error(`starter_packs ensure failed (${ins.error.code ?? "unknown"})`);
    }
    const { data: row, error } = await sb.from("starter_packs").select(COLUMNS).eq("user_id", userId).eq("version", version).maybeSingle<PackRow>();
    if (error) throw new Error(`starter_packs read failed (${error.code ?? "unknown"})`);
    if (!row) return { ok: false, reason: "user_gone" };
    const denied = claimability(row, kind, now);
    if (denied) return { ok: false, reason: denied };

    const day = utcDay(now);
    const { data: runs, error: runsError } = await sb.from("starter_pack_runs").select("user_id, kind, tokens").eq("day", day).limit(20000);
    if (runsError) throw new Error(`starter_pack_runs read failed (${runsError.code ?? "unknown"})`); // fail closed
    const today = (runs ?? []) as { user_id: string | null; kind: string; tokens: number }[];
    const cap = decideRun({
      runsToday: today.length,
      tokensToday: today.reduce((s, r) => s + Number(r.tokens ?? 0), 0),
      userRegenerationsToday: today.filter((r) => r.user_id === userId && r.kind === "regenerate").length
    }, kind, limits);
    if (cap) {
      // Queue for tomorrow. A pack that is already ready keeps showing its content.
      if (cap === "cap" && row.status !== "ready") {
        await sb.from("starter_packs").update({ status: "pending", next_attempt_at: nextUtcDayStart(now).toISOString(), last_error: "cap", lease_until: null, updated_at: nowIso }).eq("id", row.id).neq("status", "generating");
      }
      return { ok: false, reason: cap };
    }

    // Take the lease: only succeeds while the row is still in the state we read (or its lease is dead).
    const lease = { status: "generating", lease_until: new Date(now.getTime() + LEASE_MS).toISOString(), updated_at: nowIso };
    let won = sb.from("starter_packs").update(lease).eq("id", row.id).eq("status", row.status);
    if (row.status === "generating") won = won.lt("lease_until", nowIso);
    const { data: leased, error: leaseError } = await won.select(COLUMNS);
    if (leaseError) throw new Error(`starter_packs lease failed (${leaseError.code ?? "unknown"})`);
    if (!leased?.length) return { ok: false, reason: "busy" };

    const run = await sb.from("starter_pack_runs").insert({ user_id: userId, day, kind }).select("id").single<{ id: number }>();
    if (run.error || !run.data) {
      await sb.from("starter_packs").update({ status: row.status === "generating" ? "pending" : row.status, lease_until: null }).eq("id", row.id);
      throw new Error(`starter_pack_runs insert failed (${run.error?.code ?? "unknown"})`);
    }
    return { ok: true, row: leased[0] as PackRow, runId: String(run.data.id) };
  }

  async addTokens(runId: string, tokens: number) {
    if (tokens <= 0) return;
    const id = Number(runId);
    const { data } = await this.sb.from("starter_pack_runs").select("tokens").eq("id", id).maybeSingle<{ tokens: number }>();
    await this.sb.from("starter_pack_runs").update({ tokens: Number(data?.tokens ?? 0) + Math.round(tokens) }).eq("id", id);
  }

  async complete(claimed: PackRow, { content, model, tries, now }: { content: PackContent; model: string; tries: number; now: Date }) {
    const { error } = await this.sb.from("starter_packs").update({
      status: "ready", content, model, attempts: claimed.attempts + tries, last_error: null, lease_until: null, next_attempt_at: null,
      generated_at: now.toISOString(), updated_at: now.toISOString()
    }).eq("id", claimed.id);
    if (error) throw new Error(`starter_packs complete failed (${error.code ?? "unknown"})`);
  }

  async fail(claimed: PackRow, { code, tries, now }: { code: string; tries: number; now: Date }) {
    const status = claimed.content ? "ready" : "failed";
    const { error } = await this.sb.from("starter_packs").update({
      status, attempts: claimed.attempts + tries, last_error: code.slice(0, 40), lease_until: null, updated_at: now.toISOString()
    }).eq("id", claimed.id);
    if (error) throw new Error(`starter_packs fail-update failed (${error.code ?? "unknown"})`);
  }

  async listDueUserIds({ version, now, limit }: { version: number; now: Date; limit: number }) {
    const { data, error } = await this.sb.from("starter_packs").select(COLUMNS).eq("version", version).in("status", ["pending", "generating", "failed"]).limit(500);
    if (error) throw new Error(`starter_packs list failed (${error.code ?? "unknown"})`);
    return ((data ?? []) as PackRow[]).filter((r) => claimability(r, "auto", now) === null).slice(0, limit).map((r) => r.user_id);
  }
}

let shared: PackStore | null = null;
export function getPackStore(): PackStore {
  if (!shared) shared = new SupabasePackStore();
  return shared;
}
