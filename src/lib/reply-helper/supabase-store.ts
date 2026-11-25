import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { IN_FLIGHT_MS, decideRun, utcDay } from "./limits";
import type { ClaimInput, ClaimResult, ReplyStore, SaveInput } from "./store";
import type { ThreadRow } from "./types";

// Postgres-backed store (supabase/2026-11-21-reply-helper.sql). All access is the service role. Errors are thrown as
// short coded messages, never with row contents.

export const THREAD_COLUMNS = "id, user_id, source, image_count, language, read_line, transcript, drafts, tweak, runs, created_at, updated_at";

export class SupabaseReplyStore implements ReplyStore {
  private get sb() { return getSupabaseAdmin(); }

  async claim({ userId, kind, threadId, now, limits }: ClaimInput): Promise<ClaimResult> {
    const sb = this.sb;
    const day = utcDay(now);
    const { data, error } = await sb.from("reply_helper_runs").select("user_id, tokens, finished_at, created_at").eq("day", day).limit(20000);
    if (error) throw new Error(`reply_helper_runs read failed (${error.code ?? "unknown"})`); // fail closed
    const today = (data ?? []) as { user_id: string | null; tokens: number; finished_at: string | null; created_at: string }[];
    const inFlightSince = now.getTime() - IN_FLIGHT_MS;
    const denied = decideRun({
      runsToday: today.length,
      tokensToday: today.reduce((s, r) => s + Number(r.tokens ?? 0), 0),
      userRunsToday: today.filter((r) => r.user_id === userId).length,
      userInFlight: today.some((r) => r.user_id === userId && !r.finished_at && Date.parse(r.created_at) > inFlightSince)
    }, limits);
    if (denied) return { ok: false, reason: denied };

    const run = await sb.from("reply_helper_runs").insert({ user_id: userId, thread_id: threadId, day, kind }).select("id").single<{ id: number }>();
    if (run.error || !run.data) throw new Error(`reply_helper_runs insert failed (${run.error?.code ?? "unknown"})`);
    // Two submits that raced past the check above: the older row wins, the newer one backs out.
    const racing = await sb.from("reply_helper_runs").select("id").eq("user_id", userId).is("finished_at", null).gte("created_at", new Date(inFlightSince).toISOString()).lt("id", run.data.id).limit(1);
    if (racing.data?.length) {
      await sb.from("reply_helper_runs").delete().eq("id", run.data.id);
      return { ok: false, reason: "busy" };
    }
    return { ok: true, runId: String(run.data.id) };
  }

  async finish(runId: string, { tokens, outcome, now }: { tokens: number; outcome: string; now: Date }) {
    const { error } = await this.sb.from("reply_helper_runs").update({ tokens: Math.max(0, Math.round(tokens)), outcome: outcome.slice(0, 40), finished_at: now.toISOString() }).eq("id", Number(runId));
    if (error) throw new Error(`reply_helper_runs finish failed (${error.code ?? "unknown"})`);
  }

  async getThread(userId: string, id: string) {
    const { data, error } = await this.sb.from("reply_threads").select(THREAD_COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle<ThreadRow>();
    if (error) throw new Error(`reply_threads read failed (${error.code ?? "unknown"})`);
    return data ?? null;
  }

  async saveThread({ userId, threadId, source, imageCount, drafts, transcript, tweak, now }: SaveInput) {
    const sb = this.sb;
    if (threadId) {
      const existing = await this.getThread(userId, threadId);
      if (!existing) return null;
      const { data, error } = await sb.from("reply_threads").update({
        drafts, language: drafts.language, read_line: drafts.read, transcript: transcript.length ? transcript : existing.transcript,
        tweak, runs: existing.runs + 1, updated_at: now.toISOString()
      }).eq("id", threadId).eq("user_id", userId).select(THREAD_COLUMNS).maybeSingle<ThreadRow>();
      if (error) throw new Error(`reply_threads update failed (${error.code ?? "unknown"})`);
      return data ?? null;
    }
    const { data, error } = await sb.from("reply_threads").insert({
      user_id: userId, source, image_count: imageCount, language: drafts.language, read_line: drafts.read, transcript, drafts, tweak: null
    }).select(THREAD_COLUMNS).single<ThreadRow>();
    if (error || !data) throw new Error(`reply_threads insert failed (${error?.code ?? "unknown"})`);
    return data;
  }
}

let shared: ReplyStore | null = null;
export function getReplyStore(): ReplyStore {
  if (!shared) shared = new SupabaseReplyStore();
  return shared;
}
