import "server-only";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createAnthropicModel } from "./anthropic-model";
import { claimPack, executePack, runPack, type LoadedPhotos, type ModelImage, type PackDeps, type RunOutcome } from "./generate";
import { readLimits, utcDay } from "./limits";
import { buildContext } from "./prompts";
import { getPackStore } from "./supabase-store";
import { PACK_VERSION, type RunKind } from "./types";

// Wiring for the real app: Supabase store, Anthropic model, photos read from the private bucket into memory.
// Callers: onboarding completion (giveConsent), the cron sweep, the Regenerate button, and the admin trigger.

const PHOTO_COUNT = 6;
const MAX_PHOTO_BYTES = 4_500_000; // Anthropic accepts up to 5 MB per image
const MAX_TOTAL_PHOTO_BYTES = 18_000_000; // keeps the request well under the API body limit
const MEDIA_TYPES: Record<string, ModelImage["mediaType"]> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

type Admin = ReturnType<typeof getSupabaseAdmin>;

async function loadContext(sb: Admin, userId: string) {
  const [{ data: profile }, { data: prefs }, { data: apps }] = await Promise.all([
    sb.from("profiles").select("first_name, birthday, gender, interested_in, city, job, interests, voice, onboarding_done_at").eq("user_id", userId).maybeSingle(),
    sb.from("preferences").select("looking_for, dealbreakers").eq("user_id", userId).maybeSingle(),
    sb.from("app_accounts").select("app").eq("user_id", userId)
  ]);
  if (!profile?.onboarding_done_at) return null;
  return buildContext(profile, prefs ?? null, (apps ?? []).map((a) => a.app as string));
}

/** Reads the user's first photos into memory. Anything that fails to load is skipped; nothing is written or logged. */
async function loadPhotos(sb: Admin, userId: string): Promise<LoadedPhotos> {
  const { data: rows } = await sb.from("profile_photos").select("id, path, position").eq("user_id", userId).order("position").limit(PHOTO_COUNT);
  const list = rows ?? [];
  const photos: LoadedPhotos["photos"] = [];
  let bytes = 0;
  for (const row of list) {
    try {
      const mediaType = MEDIA_TYPES[row.path.split(".").pop()?.toLowerCase() ?? ""];
      if (!mediaType) continue;
      const { data, error } = await sb.storage.from("profile-photos").download(row.path);
      if (error || !data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES || bytes + buffer.length > MAX_TOTAL_PHOTO_BYTES) continue;
      bytes += buffer.length;
      photos.push({ id: row.id as string, image: { mediaType, data: buffer.toString("base64") } });
    } catch { /* one unreadable photo never stops the pack */ }
  }
  return { photos, total: list.length };
}

/** Real dependencies, or null when ANTHROPIC_API_KEY is not set (then nothing is claimed or spent). */
export function realDeps(): PackDeps | null {
  const model = createAnthropicModel();
  if (!model) return null;
  const sb = getSupabaseAdmin();
  return { store: getPackStore(), model, limits: readLimits(), loadContext: (id) => loadContext(sb, id), loadPhotos: (id) => loadPhotos(sb, id) };
}

export type PackRunResult = RunOutcome | { status: "skipped"; reason: "unconfigured" };

export async function generatePackFor(userId: string, kind: RunKind = "auto"): Promise<PackRunResult> {
  const deps = realDeps();
  if (!deps) return { status: "skipped", reason: "unconfigured" };
  try {
    return await runPack(deps, userId, kind);
  } catch {
    return { status: "failed", code: "internal" };
  }
}

/** Fire and forget after the response, for onboarding completion. Never throws, never blocks the UI. */
export function schedulePackAfterOnboarding(userId: string) {
  try {
    after(async () => { await generatePackFor(userId, "auto"); });
  } catch { /* outside a request scope: the sweep picks the user up within 10 minutes */ }
}

/** Regenerate: the lease is taken before answering (so the UI sees "preparing" at once), the model runs after. */
export async function startRegeneration(userId: string, kind: Extract<RunKind, "regenerate" | "admin">): Promise<{ ok: true } | { ok: false; reason: "unconfigured" | "limit" | "busy" | "cap" | "unavailable" }> {
  const deps = realDeps();
  if (!deps) return { ok: false, reason: "unconfigured" };
  try {
    const claimed = await claimPack(deps, userId, kind);
    if ("outcome" in claimed) {
      const o = claimed.outcome;
      if (o.status === "deferred") return { ok: false, reason: "cap" };
      return { ok: false, reason: o.status === "skipped" && o.reason === "regen_limit" ? "limit" : o.status === "skipped" && o.reason === "busy" ? "busy" : "unavailable" };
    }
    after(async () => { await executePack(deps, userId, claimed.claim).catch(() => undefined); });
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** How many Regenerate presses the user has left today (UTC). */
export async function regenerationsLeft(userId: string): Promise<number> {
  const limit = readLimits().regeneratePerUser;
  const { data } = await getSupabaseAdmin().from("starter_pack_runs").select("id").eq("user_id", userId).eq("kind", "regenerate").eq("day", utcDay(new Date())).limit(100);
  return Math.max(0, limit - (data?.length ?? 0));
}

/** Onboarded users who have no pack row yet (new users the trigger missed, and the existing users on first deploy). */
async function usersWithoutPack(sb: Admin, limit: number): Promise<string[]> {
  const [{ data: done }, { data: packs }] = await Promise.all([
    sb.from("profiles").select("user_id").not("onboarding_done_at", "is", null).order("onboarding_done_at", { ascending: true }).limit(2000),
    sb.from("starter_packs").select("user_id").eq("version", PACK_VERSION).limit(5000)
  ]);
  const have = new Set((packs ?? []).map((p) => p.user_id as string));
  return (done ?? []).map((p) => p.user_id as string).filter((id) => !have.has(id)).slice(0, limit);
}

export type SweepResult = { considered: number; ready: number; failed: number; deferred: number; skipped: number; unconfigured?: true };

/**
 * Generates for every onboarded user who has no ready pack and is due. Sequential, with a time budget so one
 * invocation stays inside the function limit; whatever is left is picked up by the next run.
 */
export async function sweepPacks({ limit = 5, budgetMs = 200_000, now = () => Date.now() }: { limit?: number; budgetMs?: number; now?: () => number } = {}): Promise<SweepResult> {
  const result: SweepResult = { considered: 0, ready: 0, failed: 0, deferred: 0, skipped: 0 };
  const deps = realDeps();
  if (!deps) return { ...result, unconfigured: true };
  const sb = getSupabaseAdmin();
  const started = now();
  const missing = await usersWithoutPack(sb, limit);
  const due = missing.length >= limit ? [] : await deps.store.listDueUserIds({ version: PACK_VERSION, now: new Date(), limit: limit - missing.length });
  for (const userId of [...missing, ...due]) {
    if (now() - started > budgetMs) break;
    result.considered += 1;
    const outcome = await generatePackFor(userId, "auto");
    if (outcome.status === "ready") result.ready += 1;
    else if (outcome.status === "failed") result.failed += 1;
    else if (outcome.status === "deferred") { result.deferred += 1; break; } // cap reached: nobody else can run today
    else result.skipped += 1;
  }
  return result;
}
