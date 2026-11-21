import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordFunnelEvent } from "@/lib/funnel";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createAnthropicModel } from "@/lib/starter-pack/anthropic-model";
import { PACK_VERSION } from "@/lib/starter-pack/types";
import { runReply, toView, type ReplyDeps } from "./generate";
import { CALL_TIMEOUT_MS, readLimits } from "./limits";
import { buildReplyContext } from "./prompts";
import { getReplyStore, THREAD_COLUMNS } from "./supabase-store";
import type { ReplyInput, ReplyOutcome, ThreadRow, ThreadView } from "./types";

// Wiring for the real app: Supabase store, Anthropic model, the user's profile (and their starter-pack lines as tone
// samples). Screenshots arrive as bytes in the request, go to the model, and are dropped: nothing is stored or logged.

type Admin = ReturnType<typeof getSupabaseAdmin>;

async function loadContext(sb: Admin, userId: string) {
  const [{ data: profile }, { data: pack }] = await Promise.all([
    sb.from("profiles").select("first_name, birthday, gender, interested_in, city, job, interests, voice").eq("user_id", userId).maybeSingle(),
    sb.from("starter_packs").select("content").eq("user_id", userId).eq("version", PACK_VERSION).eq("status", "ready").maybeSingle()
  ]);
  if (!profile) return null;
  const replies = (pack?.content as { replies?: { template?: unknown }[] } | null)?.replies ?? [];
  const samples = replies.map((r) => r.template).filter((t): t is string => typeof t === "string");
  return buildReplyContext(profile, samples);
}

/** Real dependencies, or null when ANTHROPIC_API_KEY is not set (then nothing is claimed or spent). */
export function realReplyDeps(): ReplyDeps | null {
  const model = createAnthropicModel(undefined, CALL_TIMEOUT_MS);
  if (!model) return null;
  const sb = getSupabaseAdmin();
  return { store: getReplyStore(), model, limits: readLimits(), loadContext: (id) => loadContext(sb, id) };
}

export async function runReplyFor(userId: string, input: ReplyInput): Promise<ReplyOutcome | { status: "unconfigured" }> {
  const deps = realReplyDeps();
  if (!deps) return { status: "unconfigured" };
  try {
    return await runReply(deps, userId, input);
  } catch {
    return { status: "failed", code: "internal" };
  }
}

export async function loadThread(userId: string, id: string): Promise<ThreadRow | null> {
  return getReplyStore().getThread(userId, id);
}

export async function deleteThread(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().from("reply_threads").delete().eq("id", id).eq("user_id", userId).select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** The user's saved threads, newest first (their own rows only: read through their session, so RLS applies). */
export async function listThreads(sb: SupabaseClient, limit = 20): Promise<ThreadView[]> {
  const { data } = await sb.from("reply_threads").select(THREAD_COLUMNS).order("updated_at", { ascending: false }).limit(limit);
  return ((data ?? []) as ThreadRow[]).map(toView);
}

/** Funnel events carry no user id, screenshot or text: just the event name. Never throws. */
export async function trackReplyEvent(event: "reply_helper_used" | "reply_copied", dedupeKey?: string): Promise<void> {
  try {
    await recordFunnelEvent(getSupabaseAdmin(), { event, ...(dedupeKey ? { dedupeKey } : {}) });
  } catch { /* analytics never blocks the helper */ }
}
