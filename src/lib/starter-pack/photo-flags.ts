import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { FLAG_MODEL } from "./types";
import { FLAG_SYSTEM_PROMPT, buildFlagUserPrompt } from "./prompts";
import { parsePhotoFlags, isFlagKind, type FlagKind, type PhotoVerdict } from "./photo-flags-core";
import type { ModelImage, PackModel } from "./generate";

// Server half of photo flagging (supabase/2026-11-20-photo-flags.sql). Everything runs with the service role; the
// browser can read none of it. Errors are reduced to a Postgres code; photo contents, paths and verdict text are
// never logged. Every query tolerates the migration not being applied yet (the app behaves as if nothing is flagged).

type Admin = SupabaseClient;

export function isUndefinedRelation(error: { code?: string | null } | null | undefined): boolean {
  // 42703 undefined_column, 42P01 undefined_table, PGRST204/PGRST205 not in the schema cache.
  return error?.code === "42703" || error?.code === "42P01" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

/**
 * The user's photos that are not soft-deleted, by position. Falls back to every row when deleted_at does not exist yet,
 * so the app keeps working before the migration is applied.
 */
export async function livePhotoRows<T>(sb: Admin, userId: string, columns: string, limit?: number): Promise<T[]> {
  const run = async (live: boolean) => {
    let q = sb.from("profile_photos").select(columns).eq("user_id", userId).order("position");
    if (live) q = q.is("deleted_at", null);
    if (limit) q = q.limit(limit);
    return q;
  };
  let result = await run(true);
  if (result.error && isUndefinedRelation(result.error)) result = await run(false);
  if (result.error) console.error("Photo rows read failed", result.error.code);
  return ((result.data ?? []) as unknown as T[]);
}

/** Photo ids of this user that are currently flagged for review (not approved, not removed). */
export async function flaggedPhotoIds(userId: string, sb: Admin = getSupabaseAdmin()): Promise<Set<string>> {
  const { data, error } = await sb.from("photo_flags").select("photo_id").eq("user_id", userId).eq("status", "flagged");
  if (error) { if (!isUndefinedRelation(error)) console.error("Photo flags read failed", error.code); return new Set(); }
  return new Set((data ?? []).map((r) => r.photo_id as string));
}

/** Ids a person already approved, so the model's opinion no longer applies to them. */
export async function approvedPhotoIds(sb: Admin, photoIds: string[]): Promise<Set<string>> {
  if (!photoIds.length) return new Set();
  const { data, error } = await sb.from("photo_flags").select("photo_id").in("photo_id", photoIds).eq("status", "approved");
  if (error) { if (!isUndefinedRelation(error)) console.error("Photo flags read failed", error.code); return new Set(); }
  return new Set((data ?? []).map((r) => r.photo_id as string));
}

/**
 * Writes the model's verdicts. A photo a person already approved or removed keeps that decision; everything else is
 * overwritten (a re-check can clear a flag or raise one). Best effort: throws nothing the caller must handle.
 */
export async function savePhotoVerdicts(userId: string, verdicts: PhotoVerdict[], sb: Admin = getSupabaseAdmin(), now: Date = new Date()): Promise<void> {
  if (!verdicts.length) return;
  const ids = verdicts.map((v) => v.photoId);
  const { data: existing, error: readError } = await sb.from("photo_flags").select("photo_id, status").in("photo_id", ids);
  if (readError) { if (!isUndefinedRelation(readError)) console.error("Photo flags read failed", readError.code); return; }
  const decided = new Set((existing ?? []).filter((r) => r.status === "approved" || r.status === "removed").map((r) => r.photo_id as string));
  const iso = now.toISOString();
  const rows = verdicts.filter((v) => !decided.has(v.photoId)).map((v) => ({
    photo_id: v.photoId, user_id: userId, flags: v.flags, status: v.flags.length ? "flagged" : "clear",
    checked_at: iso, flagged_at: v.flags.length ? iso : null
  }));
  if (!rows.length) return;
  const { error } = await sb.from("photo_flags").upsert(rows, { onConflict: "photo_id" });
  if (error) console.error("Photo flags save failed", error.code);
}

export type FlaggedPhoto = { photoId: string; path: string; flags: FlagKind[]; flaggedAt: string | null };

/** Flagged photos for the admin: one user's, or (no userId) the user ids that have any. */
export async function listFlaggedForUser(sb: Admin, userId: string): Promise<FlaggedPhoto[]> {
  const { data, error } = await sb.from("photo_flags").select("photo_id, flags, flagged_at").eq("user_id", userId).eq("status", "flagged");
  if (error) { if (!isUndefinedRelation(error)) console.error("Photo flags read failed", error.code); return []; }
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: photos } = await sb.from("profile_photos").select("id, path").in("id", rows.map((r) => r.photo_id as string));
  const path = new Map((photos ?? []).map((p) => [p.id as string, p.path as string]));
  return rows.filter((r) => path.has(r.photo_id as string)).map((r) => ({
    photoId: r.photo_id as string, path: path.get(r.photo_id as string)!, flags: ((r.flags ?? []) as unknown[]).filter(isFlagKind), flaggedAt: (r.flagged_at as string | null) ?? null
  }));
}

export async function usersWithFlags(sb: Admin): Promise<Map<string, number>> {
  const { data, error } = await sb.from("photo_flags").select("user_id").eq("status", "flagged").limit(2000);
  if (error) { if (!isUndefinedRelation(error)) console.error("Photo flags read failed", error.code); return new Map(); }
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.user_id as string, (counts.get(r.user_id as string) ?? 0) + 1);
  return counts;
}

/** Admin decision. Approve: the photo is cleared for good (the pack may use it). Remove: soft-delete, the user stops seeing it. */
export async function decideFlaggedPhoto(sb: Admin, userId: string, photoId: string, decision: "approve" | "remove", now: Date = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: flag, error } = await sb.from("photo_flags").select("photo_id, status").eq("photo_id", photoId).eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: isUndefinedRelation(error) ? "Photo flags are not set up yet (run supabase/2026-11-20-photo-flags.sql)." : "Couldn't read that photo." };
  if (!flag) return { ok: false, error: "That photo is no longer flagged." };
  const iso = now.toISOString();
  if (decision === "remove") {
    const del = await sb.from("profile_photos").update({ deleted_at: iso }).eq("id", photoId).eq("user_id", userId);
    if (del.error) return { ok: false, error: "Couldn't remove the photo." };
  }
  const upd = await sb.from("photo_flags").update({ status: decision === "approve" ? "approved" : "removed", reviewed_at: iso }).eq("photo_id", photoId).eq("user_id", userId);
  if (upd.error) return { ok: false, error: "Couldn't save the decision." };
  return { ok: true };
}

// ---------- sweep over existing photos ----------

const MEDIA_TYPES: Record<string, ModelImage["mediaType"]> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_PHOTO_BYTES = 4_500_000;
const MAX_TOTAL_BYTES = 18_000_000;
const PHOTOS_PER_CALL = 6;

export type FlagSweepResult = { considered: number; photos: number; flagged: number; unusable: number; skipped: number; unconfigured?: true };

/** Users who have a live photo with no photo_flags row yet, oldest photo first. */
async function usersWithUnreviewedPhotos(sb: Admin, limit: number): Promise<string[]> {
  const live = await sb.from("profile_photos").select("id, user_id").is("deleted_at", null).order("created_at", { ascending: true }).limit(3000);
  if (live.error) { if (!isUndefinedRelation(live.error)) console.error("Photo sweep read failed", live.error.code); return []; }
  const checked = await sb.from("photo_flags").select("photo_id").limit(10000);
  if (checked.error) { if (!isUndefinedRelation(checked.error)) console.error("Photo sweep read failed", checked.error.code); return []; }
  const done = new Set((checked.data ?? []).map((r) => r.photo_id as string));
  const users: string[] = [];
  for (const row of live.data ?? []) {
    if (done.has(row.id as string) || users.includes(row.user_id as string)) continue;
    users.push(row.user_id as string);
    if (users.length >= 50) break;
  }
  // Random pick among the waiting users, so one user whose photos never load cannot starve everyone behind them.
  for (let i = users.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [users[i], users[j]] = [users[j], users[i]]; }
  return users.slice(0, limit);
}

/**
 * Flag-only pass over photos uploaded before flagging existed (and any added since without a pack run). One cheap call per
 * user, up to six unreviewed photos each, sequential, inside a time budget so one invocation fits a 60 s function.
 * A photo the model did not report on is left unreviewed and picked up next time; an unusable answer flags nothing.
 */
export async function sweepPhotoFlags({ model, limit = 3, budgetMs = 40_000, now = () => Date.now(), sb = getSupabaseAdmin() }: { model: PackModel | null; limit?: number; budgetMs?: number; now?: () => number; sb?: Admin }): Promise<FlagSweepResult> {
  const result: FlagSweepResult = { considered: 0, photos: 0, flagged: 0, unusable: 0, skipped: 0 };
  if (!model) return { ...result, unconfigured: true };
  const started = now();
  for (const userId of await usersWithUnreviewedPhotos(sb, limit)) {
    if (now() - started > budgetMs) break;
    result.considered += 1;
    try {
      const rows = await livePhotoRows<{ id: string; path: string }>(sb, userId, "id, path", 60);
      const { data: checked } = await sb.from("photo_flags").select("photo_id").in("photo_id", rows.map((r) => r.id));
      const done = new Set((checked ?? []).map((r) => r.photo_id as string));
      const photos: { id: string; image: ModelImage }[] = [];
      let bytes = 0;
      for (const row of rows.filter((r) => !done.has(r.id))) {
        if (photos.length >= PHOTOS_PER_CALL) break;
        const mediaType = MEDIA_TYPES[row.path.split(".").pop()?.toLowerCase() ?? ""];
        if (!mediaType) continue;
        const file = await sb.storage.from("profile-photos").download(row.path);
        if (file.error || !file.data) continue;
        const buffer = Buffer.from(await file.data.arrayBuffer());
        if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES || bytes + buffer.length > MAX_TOTAL_BYTES) continue;
        bytes += buffer.length;
        photos.push({ id: row.id, image: { mediaType, data: buffer.toString("base64") } });
      }
      if (!photos.length) { result.skipped += 1; continue; }
      const res = await model.complete({ system: FLAG_SYSTEM_PROMPT, user: buildFlagUserPrompt(photos.length), images: photos.map((p) => p.image), maxTokens: 600, model: FLAG_MODEL });
      const verdicts = res.stopReason === "refusal" ? null : parsePhotoFlags(res.text, photos);
      if (!verdicts) { result.unusable += 1; console.error("Photo flags unusable", res.stopReason === "refusal" ? "refusal" : "bad_json"); continue; }
      await savePhotoVerdicts(userId, verdicts, sb);
      result.photos += verdicts.length;
      result.flagged += verdicts.filter((v) => v.flags.length > 0).length;
    } catch (error) {
      result.skipped += 1;
      console.error("Photo sweep failed for a user", (error as { code?: string; name?: string } | null)?.code ?? (error as { name?: string } | null)?.name ?? "unknown");
    }
  }
  return result;
}
