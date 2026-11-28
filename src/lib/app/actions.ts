"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTimezone } from "@/lib/timezone";
import { addSystemEvent } from "@/lib/automation/core";
import { CONSENT_STATEMENT, CONSENT_VERSION, APPS, SEND_REFUSALS, VOICES, canUserSend, chatMode, stepSchemas, type StepName } from "@/lib/app/domain";
import { createAppClient, userOrNull } from "@/lib/app/session";
import { ensureProfile } from "@/lib/app/actions-core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { schedulePackAfterOnboarding } from "@/lib/starter-pack/service";
import { clearConsentRequest } from "@/lib/operator/auto-kit";

export type ActionResult = { ok: true } | { ok: false; error: string };
const UNAUTH: ActionResult = { ok: false, error: "Your session ended. Sign in again." };
const DB_ERR: ActionResult = { ok: false, error: "Couldn't save. Try again." };
const uuid = z.string().uuid();
/** The database does not have the column, table or status value yet (the migration has not run). */
const isSchemaGap = (error: { code?: string | null } | null | undefined) => ["42703", "42P01", "PGRST204", "PGRST205", "23514"].includes(error?.code ?? "");

async function ctx() {
  const user = await userOrNull();
  if (!user) return null;
  const sb = getSupabaseAdmin();
  await ensureProfile(sb, user.id, user.email);
  return { user, sb };
}

/** Saves one onboarding/profile step. The same validators serve onboarding and the profile editor. */
export async function saveStep(step: StepName, payload: unknown, stepIndex?: number): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const parsed = stepSchemas[step].safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your answers." };
  const { sb, user } = c;
  const v = parsed.data as never as Record<string, unknown>;
  const now = new Date().toISOString();
  let error: unknown = null;
  if (step === "name") ({ error } = await sb.from("profiles").update({ first_name: v.firstName || null, updated_at: now }).eq("user_id", user.id));
  if (step === "birthday") ({ error } = await sb.from("profiles").update({ birthday: v.birthday || null, updated_at: now }).eq("user_id", user.id));
  if (step === "who") ({ error } = await sb.from("profiles").update({ gender: v.gender || null, interested_in: v.interestedIn, updated_at: now }).eq("user_id", user.id));
  if (step === "about") ({ error } = await sb.from("profiles").update({ job: v.job || null, height_cm: v.heightCm, interests: v.interests, updated_at: now }).eq("user_id", user.id));
  if (step === "type") {
    const r1 = await sb.from("profiles").update({ city: v.city || null, updated_at: now }).eq("user_id", user.id);
    const r2 = await sb.from("preferences").upsert({ user_id: user.id, age_min: v.ageMin, age_max: v.ageMax, distance_km: v.distanceKm, looking_for: v.lookingFor || null, dealbreakers: v.dealbreakers, updated_at: now }, { onConflict: "user_id" });
    error = r1.error ?? r2.error;
  }
  if (step === "apps") {
    const chosen = v.apps as string[];
    const { data: existing } = await sb.from("app_accounts").select("app, status").eq("user_id", user.id);
    const have = new Set((existing ?? []).map((a) => a.app));
    // We create the profile ourselves: a picked app is just a new row that starts as "setting up".
    const add = chosen.filter((a) => !have.has(a)).map((app) => ({ user_id: user.id, app, status: "setting_up" }));
    if (add.length) ({ error } = await sb.from("app_accounts").insert(add));
    const drop = (existing ?? []).filter((a) => !chosen.includes(a.app) && (a.status === "setting_up" || a.status === "awaiting_login")).map((a) => a.app);
    if (!error && drop.length) ({ error } = await sb.from("app_accounts").delete().eq("user_id", user.id).in("app", drop));
  }
  if (error) return DB_ERR;
  if (typeof stepIndex === "number") await sb.from("profiles").update({ onboarding_step: stepIndex }).eq("user_id", user.id).lt("onboarding_step", stepIndex);
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Onboarding lets a visitor answer the first questions before signing in. Right after the email code
 * those answers are saved here, once, and only onto a brand-new profile: an existing account's
 * answers are never overwritten.
 */
export async function adoptGuestAnswers(input: { firstName: string; birthday: string; gender: string; interestedIn: string[] }, browserTimezone?: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const { sb, user } = c;
  const { data: row } = await sb.from("profiles").select("first_name, birthday, gender, onboarding_step, onboarding_done_at, timezone").eq("user_id", user.id).maybeSingle();
  if (!row || row.onboarding_done_at || row.first_name || row.birthday || row.gender || (row.onboarding_step ?? 0) > 0) { await rememberTimezone(sb, user.id, browserTimezone); return { ok: true }; }
  const name = stepSchemas.name.safeParse({ firstName: input.firstName });
  const birthday = stepSchemas.birthday.safeParse({ birthday: input.birthday });
  const who = stepSchemas.who.safeParse({ gender: input.gender, interestedIn: input.interestedIn });
  const patch: Record<string, unknown> = { onboarding_step: 1, updated_at: new Date().toISOString() };
  const zone = normalizeTimezone(browserTimezone);
  if (zone && !row.timezone) patch.timezone = zone;
  if (name.success && name.data.firstName) patch.first_name = name.data.firstName;
  if (birthday.success && birthday.data.birthday) patch.birthday = birthday.data.birthday;
  if (who.success) { if (who.data.gender) patch.gender = who.data.gender; patch.interested_in = who.data.interestedIn; }
  const { error } = await sb.from("profiles").update(patch).eq("user_id", user.id);
  return error ? DB_ERR : { ok: true };
}

/**
 * The browser's own IANA zone, saved silently with the basics (no question asked). Validated here, only fills an empty value (an operator's
 * edit or an earlier capture wins), and never blocks onboarding: a failure just leaves it null.
 */
async function rememberTimezone(sb: SupabaseClient, userId: string, browserTimezone: string | undefined): Promise<void> {
  const zone = normalizeTimezone(browserTimezone);
  if (!zone) return;
  await sb.from("profiles").update({ timezone: zone }).eq("user_id", userId).is("timezone", null);
}

/** The one-screen basics (name, birthday, who): one check, one write, then on to the next step. */
export async function saveBasics(input: { firstName: string; birthday: string; gender: string; interestedIn: string[] }, stepIndex: number, browserTimezone?: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const name = stepSchemas.name.safeParse({ firstName: input.firstName });
  const birthday = stepSchemas.birthday.safeParse({ birthday: input.birthday });
  const who = stepSchemas.who.safeParse({ gender: input.gender, interestedIn: input.interestedIn });
  if (!name.success) return { ok: false, error: name.error.issues[0]?.message ?? "Check your answers." };
  if (!birthday.success) return { ok: false, error: birthday.error.issues[0]?.message ?? "Check your answers." };
  if (!who.success) return { ok: false, error: who.error.issues[0]?.message ?? "Check your answers." };
  const { sb, user } = c;
  const { error } = await sb.from("profiles").update({ first_name: name.data.firstName || null, birthday: birthday.data.birthday || null, gender: who.data.gender || null, interested_in: who.data.interestedIn, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) return DB_ERR;
  await rememberTimezone(sb, user.id, browserTimezone);
  if (Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex <= 6) await sb.from("profiles").update({ onboarding_step: stepIndex }).eq("user_id", user.id).lt("onboarding_step", stepIndex);
  revalidatePath("/profile");
  return { ok: true };
}

/** Remembers how far through onboarding the user is (steps without their own save, like photos). */
export async function advanceStep(stepIndex: number): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 6) return DB_ERR;
  await c.sb.from("profiles").update({ onboarding_step: stepIndex }).eq("user_id", c.user.id).lt("onboarding_step", stepIndex);
  return { ok: true };
}

/** The 18+ gate: the explicit confirmation is required (birthday is optional), and the server checks it. */
export async function giveConsent(confirmAdult: boolean): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  if (confirmAdult !== true) return { ok: false, error: "Please confirm you are 18 or older." };
  const { sb, user } = c;
  // A double tap or a retry after a dropped connection must not record the same consent twice.
  const { data: given, error: readError } = await sb.from("consents").select("id").eq("user_id", user.id).eq("version", CONSENT_VERSION).limit(1);
  if (readError) return DB_ERR;
  if (!given?.length) {
    const { error } = await sb.from("consents").insert({ user_id: user.id, version: CONSENT_VERSION, statement: CONSENT_STATEMENT });
    if (error) return DB_ERR;
  }
  const { error: doneError } = await sb.from("profiles").update({ onboarding_done_at: new Date().toISOString() }).eq("user_id", user.id).is("onboarding_done_at", null);
  // Starter pack: written after this response, never blocking it. A repeat call is a no-op (one pack per user per
  // version), and the 10-minute sweep covers anything that fails here.
  // The consent the team asked for on their Home (an automatic kit for a client who never confirmed) is answered now.
  await clearConsentRequest(sb, user.id).catch(() => 0);
  if (!doneError) schedulePackAfterOnboarding(user.id);
  return { ok: true };
}

export async function removePhoto(id: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c || !uuid.safeParse(id).success) return UNAUTH;
  const { sb, user } = c;
  const { data } = await sb.from("profile_photos").select("path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) return { ok: true };
  await sb.storage.from("profile-photos").remove([data.path]);
  const { error } = await sb.from("profile_photos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return DB_ERR;
  const { data: rest } = await sb.from("profile_photos").select("id").eq("user_id", user.id).order("position");
  await Promise.all((rest ?? []).map((r, i) => sb.from("profile_photos").update({ position: i }).eq("id", r.id)));
  return { ok: true };
}

export async function reorderPhotos(ids: string[]): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const parsed = z.array(z.string().uuid()).max(12).safeParse(ids);
  if (!parsed.success) return DB_ERR;
  const { sb, user } = c;
  await Promise.all(parsed.data.map((id, i) => sb.from("profile_photos").update({ position: i }).eq("id", id).eq("user_id", user.id)));
  return { ok: true };
}

async function ownedMatch(sb: ReturnType<typeof getSupabaseAdmin>, userId: string, matchId: string) {
  if (!uuid.safeParse(matchId).success) return null;
  const { data } = await sb.from("matches").select("id, app").eq("id", matchId).eq("user_id", userId).maybeSingle();
  return data;
}

export async function takeOver(matchId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const match = await ownedMatch(c.sb, c.user.id, matchId);
  if (!match) return { ok: false, error: "Chat not found." };
  const { error } = await c.sb.from("takeovers").insert({ match_id: matchId, user_id: c.user.id });
  // 23505: already taken over (double tap); the state is what the user asked for.
  if (error && error.code !== "23505") return DB_ERR;
  if (!error) await addSystemEvent(c.sb, matchId, c.user.id, { kind: "took_over" });
  await c.sb.from("matches").update({ needs_user: false, needs_reason: null }).eq("id", matchId);
  revalidatePath(`/chats/${matchId}`);
  return { ok: true };
}

export async function handBack(matchId: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const match = await ownedMatch(c.sb, c.user.id, matchId);
  if (!match) return { ok: false, error: "Chat not found." };
  const { data: ended, error } = await c.sb.from("takeovers").update({ ended_at: new Date().toISOString() }).eq("match_id", matchId).eq("user_id", c.user.id).is("ended_at", null).select("id");
  if (error) return DB_ERR;
  if (ended?.length) await addSystemEvent(c.sb, matchId, c.user.id, { kind: "handed_back" });
  revalidatePath(`/chats/${matchId}`);
  return { ok: true };
}

export async function sendMyMessage(matchId: string, body: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const text = body.trim();
  if (!text || text.length > 4000) return { ok: false, error: "Write a message first." };
  const match = await ownedMatch(c.sb, c.user.id, matchId);
  if (!match) return { ok: false, error: "Chat not found." };
  const { data: takeovers } = await c.sb.from("takeovers").select("ended_at").eq("match_id", matchId);
  const decision = canUserSend(chatMode(takeovers ?? []));
  if (!decision.ok) return { ok: false, error: SEND_REFUSALS[decision.reason] };
  // delivered_at stays null until the worker has sent it inside the dating app (docs/automation.md).
  const { error } = await c.sb.from("messages").insert({ match_id: matchId, user_id: c.user.id, sender: "user", body: text });
  if (error) return error.code === "P0001" ? { ok: false, error: SEND_REFUSALS.no_takeover } : DB_ERR;
  return { ok: true };
}

/** Pause (paused = true) or Resume (false). Resume also hands back any chats the client took over with "Take over" on that app. */
export async function setAppPaused(app: string, paused: boolean): Promise<ActionResult> {
  const c = await ctx();
  if (!c || !z.enum(APPS).safeParse(app).success) return UNAUTH;
  const { error } = await c.sb.from("app_accounts").update({ user_paused: paused, updated_at: new Date().toISOString() }).eq("user_id", c.user.id).eq("app", app);
  if (error) return DB_ERR;
  if (!paused) await endAppTakeovers(c.sb, c.user.id, app);
  revalidatePath("/profile"); revalidatePath("/home"); revalidatePath("/chats");
  return { ok: true };
}

/** Matches of one app that belong to this user. */
async function appMatchIds(sb: ReturnType<typeof getSupabaseAdmin>, userId: string, app: string): Promise<string[]> {
  const { data } = await sb.from("matches").select("id").eq("user_id", userId).eq("app", app);
  return (data ?? []).map((m) => m.id as string);
}

async function endAppTakeovers(sb: ReturnType<typeof getSupabaseAdmin>, userId: string, app: string) {
  const ids = await appMatchIds(sb, userId, app);
  if (!ids.length) return;
  // `source` exists after supabase/2026-11-21-account-runs.sql; before it nothing was ever started from Home, so there is nothing to hand back.
  const { data: ended, error } = await sb.from("takeovers").update({ ended_at: new Date().toISOString() }).eq("user_id", userId).eq("source", "app").in("match_id", ids).is("ended_at", null).select("match_id");
  if (error) return;
  await Promise.all((ended ?? []).map((t) => addSystemEvent(sb, t.match_id as string, userId, { kind: "handed_back" })));
}

/**
 * "Take over" on an app card: the client drives this app themselves for now. Nothing is sent as them (the app is paused) and every
 * open chat on it moves to "you took over", so what they type goes out and nothing is written over it. Resume hands those chats back.
 */
export async function takeOverApp(app: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c || !z.enum(APPS).safeParse(app).success) return UNAUTH;
  const { error } = await c.sb.from("app_accounts").update({ user_paused: true, updated_at: new Date().toISOString() }).eq("user_id", c.user.id).eq("app", app);
  if (error) return DB_ERR;
  const ids = await appMatchIds(c.sb, c.user.id, app);
  if (ids.length) {
    const { data: open } = await c.sb.from("takeovers").select("match_id").in("match_id", ids).is("ended_at", null);
    const taken = new Set((open ?? []).map((t) => t.match_id as string));
    for (const id of ids.filter((m) => !taken.has(m))) {
      let r = await c.sb.from("takeovers").insert({ match_id: id, user_id: c.user.id, source: "app" });
      if (r.error && isSchemaGap(r.error)) r = await c.sb.from("takeovers").insert({ match_id: id, user_id: c.user.id });
      // 23505: the chat was taken over a moment ago by another tap; that is the state we want.
      if (r.error && r.error.code !== "23505") return DB_ERR;
      if (!r.error) await addSystemEvent(c.sb, id, c.user.id, { kind: "took_over" });
      await c.sb.from("matches").update({ needs_user: false, needs_reason: null }).eq("id", id);
    }
  }
  revalidatePath("/profile"); revalidatePath("/home"); revalidatePath("/chats");
  return { ok: true };
}

/** The client's answer to a date the team booked: confirm it, or decline it (a declined date leaves Dates and the team sees it in the log). */
export async function respondToDate(id: string, response: "confirmed" | "declined"): Promise<ActionResult> {
  const c = await ctx();
  if (!c || !uuid.safeParse(id).success || (response !== "confirmed" && response !== "declined")) return UNAUTH;
  const { data: date } = await c.sb.from("dates").select("id, who, status").eq("id", id).eq("user_id", c.user.id).maybeSingle();
  if (!date) return { ok: false, error: "Date not found." };
  if (date.status === "cancelled") return { ok: false, error: "This date was cancelled." };
  const nowIso = new Date().toISOString();
  const { error } = await c.sb.from("dates").update({ client_response: response, responded_at: nowIso, ...(response === "declined" ? { status: "cancelled" } : {}) }).eq("id", id).eq("user_id", c.user.id);
  if (error) {
    if (response === "declined" && isSchemaGap(error)) {
      const r = await c.sb.from("dates").update({ status: "cancelled" }).eq("id", id).eq("user_id", c.user.id);
      if (r.error) return DB_ERR;
    } else return DB_ERR;
  }
  await c.sb.from("fulfilment_events").insert({ user_id: c.user.id, actor: "client", action: "note", note: response === "declined" ? `Client declined the date with ${date.who}.` : `Client confirmed the date with ${date.who}.` });
  revalidatePath("/dates"); revalidatePath("/home"); revalidatePath(`/dates/${id}`);
  return { ok: true };
}

export async function saveSettings(input: { voice: string; notifyEmail: boolean }): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  if (!(VOICES as readonly string[]).includes(input.voice)) return { ok: false, error: "Pick a tone." };
  const { error } = await c.sb.from("profiles").update({ voice: input.voice, notify_email: !!input.notifyEmail, updated_at: new Date().toISOString() }).eq("user_id", c.user.id);
  return error ? DB_ERR : { ok: true };
}

export async function signOutUser(): Promise<void> {
  try {
    const supabase = await createAppClient();
    await supabase.auth.signOut();
  } catch { /* the redirect below signs the user out of the UI regardless */ }
  redirect("/login");
}

/** Deletes the user's photos from storage, then the auth user; every row cascades from auth.users. */
export async function deleteAccount(confirm: string): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  if (confirm.trim().toLowerCase() !== "delete") return { ok: false, error: "Type DELETE to confirm." };
  const { sb, user } = c;
  try {
    for (let i = 0; i < 20; i++) {
      const { data } = await sb.storage.from("profile-photos").list(user.id, { limit: 100 });
      if (!data?.length) break;
      await sb.storage.from("profile-photos").remove(data.map((f) => `${user.id}/${f.name}`));
    }
    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch {
    return { ok: false, error: "Couldn't delete everything. Try again, or email support@noswipe.app." };
  }
  try { const supabase = await createAppClient(); await supabase.auth.signOut(); } catch { /* session is gone with the user */ }
  redirect("/login?deleted=1");
}
