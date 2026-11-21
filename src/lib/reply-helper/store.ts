// Storage contract for the Reply helper, plus an in-memory implementation used by the unit tests. The Supabase
// implementation (supabase-store.ts) follows the same rules: the daily caps and the per-user limit are counted from the
// runs ledger, a run that has started and not finished blocks a second one from the same user (double submit), and a
// finished run is never refunded, whatever its outcome.
import { IN_FLIGHT_MS, decideRun, utcDay, type Denial, type ReplyLimits } from "./limits";
import type { Drafts, ReplyKind, ThreadRow, ThreadSource, Tweak, Turn } from "./types";

export type ClaimInput = { userId: string; kind: ReplyKind; threadId: string | null; now: Date; limits: ReplyLimits };
export type ClaimResult = { ok: true; runId: string } | { ok: false; reason: Denial };
export type SaveInput = {
  userId: string; threadId: string | null; source: ThreadSource; imageCount: number; drafts: Drafts; transcript: Turn[]; tweak: Tweak | null; now: Date;
};

export interface ReplyStore {
  claim(input: ClaimInput): Promise<ClaimResult>;
  /** Closes the ledger row: spend (weighted tokens) and a short outcome code. Called on every exit. */
  finish(runId: string, result: { tokens: number; outcome: string; now: Date }): Promise<void>;
  getThread(userId: string, id: string): Promise<ThreadRow | null>;
  /** Inserts a thread, or replaces the drafts of `threadId` (runs + 1). Returns null when `threadId` is not the user's. */
  saveThread(input: SaveInput): Promise<ThreadRow | null>;
}

export class MemoryReplyStore implements ReplyStore {
  threads: ThreadRow[] = [];
  runs: { id: string; userId: string; day: string; kind: ReplyKind; tokens: number; outcome: string | null; startedAt: number; finished: boolean }[] = [];
  private seq = 0;

  async claim({ userId, kind, now, limits }: ClaimInput): Promise<ClaimResult> {
    const day = utcDay(now);
    const today = this.runs.filter((r) => r.day === day);
    const denied = decideRun({
      runsToday: today.length,
      tokensToday: today.reduce((s, r) => s + r.tokens, 0),
      userRunsToday: today.filter((r) => r.userId === userId).length,
      userInFlight: this.runs.some((r) => r.userId === userId && !r.finished && now.getTime() - r.startedAt < IN_FLIGHT_MS)
    }, limits);
    if (denied) return { ok: false, reason: denied };
    const id = `r${++this.seq}`;
    this.runs.push({ id, userId, day, kind, tokens: 0, outcome: null, startedAt: now.getTime(), finished: false });
    return { ok: true, runId: id };
  }

  async finish(runId: string, { tokens, outcome }: { tokens: number; outcome: string; now: Date }) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) Object.assign(run, { tokens: Math.max(0, tokens), outcome, finished: true });
  }

  async getThread(userId: string, id: string) {
    return this.threads.find((t) => t.id === id && t.user_id === userId) ?? null;
  }

  async saveThread({ userId, threadId, source, imageCount, drafts, transcript, tweak, now }: SaveInput) {
    if (threadId) {
      const row = this.threads.find((t) => t.id === threadId && t.user_id === userId);
      if (!row) return null;
      Object.assign(row, { drafts, language: drafts.language, read_line: drafts.read, transcript: transcript.length ? transcript : row.transcript, tweak, runs: row.runs + 1, updated_at: now.toISOString() });
      return row;
    }
    const row: ThreadRow = {
      id: `t${++this.seq}`, user_id: userId, source, image_count: imageCount, language: drafts.language, read_line: drafts.read,
      transcript, drafts, tweak, runs: 1, created_at: now.toISOString(), updated_at: now.toISOString()
    };
    this.threads.push(row);
    return row;
  }
}
