"use server";

import { revalidatePath } from "next/cache";
import { adminEmailOrNull } from "@/lib/admin-auth";
import * as core from "@/lib/automation/core";
import { setRun } from "@/lib/activity/service";
import { addNoteEvent } from "@/lib/fulfilment/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { startRegeneration } from "@/lib/starter-pack/service";
import { decideFlaggedPhoto } from "@/lib/starter-pack/photo-flags";

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
  const admin = await adminEmailOrNull();
  if (!admin || !uuid.test(userId)) return NOT_ALLOWED;
  const result = await core.setAppStatus(getSupabaseAdmin(), userId, String(formData.get("app")), { status: formData.get("status"), reason: formData.get("reason") ?? undefined, note: formData.get("note") ?? undefined }, admin);
  if (result.ok && !result.logged) {
    revalidatePath(`/admin/clients/${userId}`);
    return { error: "Status saved, but the change could not be logged. Run supabase/2026-11-20-fulfilment.sql." };
  }
  revalidatePath("/admin/fulfilment");
  return done(result, userId, "Status saved");
}

/** The Run panel: which phone and internal account label run this client's app, and when their one-time login is scheduled. */
export async function setRunAction(userId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  const admin = await adminEmailOrNull();
  if (!admin || !uuid.test(userId)) return NOT_ALLOWED;
  const app = String(formData.get("app") ?? "");
  const phoneId = String(formData.get("phoneId") ?? "").trim();
  const accountRef = String(formData.get("accountRef") ?? "").trim();
  const when = String(formData.get("loginAt") ?? "").trim();
  const tz = Number(formData.get("tzOffset") ?? 0); // minutes behind UTC, from the admin's browser
  let loginScheduledAt: string | null | undefined;
  if (formData.get("clearLogin") === "1") loginScheduledAt = null;
  else if (when) {
    const t = new Date(`${when}:00Z`);
    if (Number.isNaN(t.getTime())) return { error: "Pick a valid login time." };
    loginScheduledAt = new Date(t.getTime() + (Number.isFinite(tz) ? tz : 0) * 60000).toISOString();
  }
  const sb = getSupabaseAdmin();
  const result = await setRun(sb, admin, userId, app, { phoneId: phoneId || null, accountRef: accountRef || null, ...(loginScheduledAt !== undefined ? { loginScheduledAt } : {}) });
  if (!result.ok) return { error: result.message };
  await addNoteEvent(sb, admin, userId, `Run set: phone ${phoneId || "none"}, account ${accountRef || "none"}${loginScheduledAt ? `, login ${loginScheduledAt}` : loginScheduledAt === null ? ", login time cleared" : ""}.`, app);
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath("/admin/fulfilment");
  return { ok: "Run saved" };
}

export async function addNoteAction(userId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  const admin = await adminEmailOrNull();
  if (!admin || !uuid.test(userId)) return NOT_ALLOWED;
  const result = await addNoteEvent(getSupabaseAdmin(), admin, userId, formData.get("note"), String(formData.get("app") ?? ""));
  if (!result.ok) return { error: result.message };
  revalidatePath(`/admin/clients/${userId}`);
  return { ok: "Note saved" };
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

/** Writes (or rewrites) the user's starter pack now. Honours the daily caps; ignores the user's 3-per-day regenerate limit. */
export async function generatePackAction(userId: string, _prev: OpState, _formData: FormData): Promise<OpState> {
  void _formData;
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  const { data: profile } = await getSupabaseAdmin().from("profiles").select("onboarding_done_at").eq("user_id", userId).maybeSingle();
  if (!profile?.onboarding_done_at) return { error: "This user has not finished onboarding." };
  const started = await startRegeneration(userId, "admin");
  if (!started.ok) {
    const why = { unconfigured: "ANTHROPIC_API_KEY is not set.", busy: "A pack is already being written for this user.", cap: "The daily pack cap is reached; it is queued for tomorrow.", limit: "Limit reached.", unavailable: "Couldn't start. Try again." }[started.reason];
    return { error: why };
  }
  revalidatePath(`/admin/clients/${userId}`);
  return { ok: "Started. Reload in a minute." };
}

/**
 * A person's decision on a photo the model flagged. Approve: the flag was a false positive; the photo is cleared for good
 * and the pack is written again so it can use it. Remove: soft-delete (the user stops seeing it; the flag stays on record).
 */
export async function decideFlaggedPhotoAction(userId: string, decision: "approve" | "remove", _prev: OpState, formData: FormData): Promise<OpState> {
  if (!(await adminEmailOrNull()) || !uuid.test(userId)) return NOT_ALLOWED;
  const photoId = String(formData.get("photoId") ?? "");
  if (!uuid.test(photoId)) return { error: "Unknown photo." };
  const result = await decideFlaggedPhoto(getSupabaseAdmin(), userId, photoId, decision);
  if (!result.ok) return { error: result.error };
  // Best effort: a capped or busy pack run must not turn a saved decision into an error.
  if (decision === "approve") await startRegeneration(userId, "admin").catch(() => undefined);
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath("/admin/clients");
  return { ok: decision === "approve" ? "Approved. The photo can be used." : "Removed." };
}
