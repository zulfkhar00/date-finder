"use server";

import { revalidatePath } from "next/cache";
import { adminEmailOrNull } from "@/lib/admin-auth";
import * as core from "@/lib/automation/core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type OpState = { ok?: string; error?: string };
const NOT_ALLOWED: OpState = { error: "Not authorized." };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function done<T extends { ok: boolean }>(result: T | core.Failure, userId: string, message: string): OpState {
  if (!result.ok) return { error: (result as core.Failure).message };
  revalidatePath(`/admin/clients/${userId}`);
  return { ok: message };
}

// Every action here: the admin session is checked first, then the shared automation core does the
// work, so the same rules (no AI sends during a takeover or pause) apply as for the worker API.

export async function setAppStatusAction(userId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  return done(await core.setAppStatus(getSupabaseAdmin(), userId, String(formData.get("app")), { status: formData.get("status") }), userId, "Status saved");
}

export async function addMatchAction(userId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  const ageRaw = String(formData.get("age") ?? "").trim();
  const sb = getSupabaseAdmin();
  const result = await core.addMatch(sb, userId, { app: formData.get("app"), name: formData.get("name"), age: ageRaw ? Number(ageRaw) : null });
  if (!result.ok) return { error: result.message };
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "Match added, but the photo must be a JPG, PNG or WebP under 4 MB." };
    const path = `${userId}/match-${result.matchId}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
    const up = await sb.storage.from("profile-photos").upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: true });
    if (up.error) return { error: "Match added, but the photo upload failed." };
    await sb.from("matches").update({ photo_path: path }).eq("id", result.matchId);
  }
  return done(result, userId, "Match added");
}

export async function addMessageAction(userId: string, matchId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  const result = await core.addMessage(getSupabaseAdmin(), matchId, { sender: formData.get("sender"), body: formData.get("body") });
  if (!result.ok && result.code === "taken_over") return { error: "Blocked: the user has taken over this chat. Only the match's messages can be added." };
  if (!result.ok && result.code === "app_paused") return { error: "Blocked: the user paused this app." };
  return done(result, userId, "Message added");
}

export async function setNeedsYouAction(userId: string, matchId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  return done(await core.setNeedsYou(getSupabaseAdmin(), matchId, { needsUser: formData.get("needs") === "1", reason: String(formData.get("reason") ?? "") || undefined }), userId, "Updated");
}

export async function addDateAction(userId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  const startsRaw = String(formData.get("startsAt") ?? "");
  const tz = Number(formData.get("tzOffset") ?? 0); // minutes behind UTC, from the admin's browser
  const when = new Date(`${startsRaw}:00Z`);
  if (!startsRaw || Number.isNaN(when.getTime())) return { error: "Pick a date and time." };
  const startsAt = new Date(when.getTime() + (Number.isFinite(tz) ? tz : 0) * 60000).toISOString();
  const match = String(formData.get("matchId") ?? "");
  return done(await core.bookDate(getSupabaseAdmin(), userId, {
    matchId: uuid.test(match) ? match : null, who: formData.get("who"), venue: formData.get("venue"),
    address: String(formData.get("address") ?? "") || null, startsAt, summary: String(formData.get("summary") ?? "") || null
  }), userId, "Date booked (the user is emailed if they allow it)");
}
