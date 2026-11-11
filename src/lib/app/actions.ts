"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addSystemEvent } from "@/lib/automation/core";
import { CONSENT_STATEMENT, CONSENT_VERSION, APPS, SEND_REFUSALS, VOICES, canUserSend, chatMode, stepSchemas, type StepName } from "@/lib/app/domain";
import { createAppClient, userOrNull } from "@/lib/app/session";
import { ensureProfile } from "@/lib/app/actions-core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ActionResult = { ok: true } | { ok: false; error: string };
const UNAUTH: ActionResult = { ok: false, error: "Your session ended. Sign in again." };
const DB_ERR: ActionResult = { ok: false, error: "Couldn't save. Try again." };
const uuid = z.string().uuid();

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
    const add = chosen.filter((a) => !have.has(a)).map((app) => ({ user_id: user.id, app, status: "setting_up" }));
    if (add.length) ({ error } = await sb.from("app_accounts").insert(add));
    const drop = (existing ?? []).filter((a) => !chosen.includes(a.app) && a.status === "setting_up").map((a) => a.app);
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
export async function adoptGuestAnswers(input: { firstName: string; birthday: string; gender: string; interestedIn: string[] }): Promise<ActionResult> {
  const c = await ctx();
  if (!c) return UNAUTH;
  const { sb, user } = c;
  const { data: row } = await sb.from("profiles").select("first_name, birthday, gender, onboarding_step, onboarding_done_at").eq("user_id", user.id).maybeSingle();
  if (!row || row.onboarding_done_at || row.first_name || row.birthday || row.gender || (row.onboarding_step ?? 0) > 0) return { ok: true };
  const name = stepSchemas.name.safeParse({ firstName: input.firstName });
  const birthday = stepSchemas.birthday.safeParse({ birthday: input.birthday });
  const who = stepSchemas.who.safeParse({ gender: input.gender, interestedIn: input.interestedIn });
  const patch: Record<string, unknown> = { onboarding_step: 1, updated_at: new Date().toISOString() };
  if (name.success && name.data.firstName) patch.first_name = name.data.firstName;
  if (birthday.success && birthday.data.birthday) patch.birthday = birthday.data.birthday;
  if (who.success) { if (who.data.gender) patch.gender = who.data.gender; patch.interested_in = who.data.interestedIn; }
  const { error } = await sb.from("profiles").update(patch).eq("user_id", user.id);
  return error ? DB_ERR : { ok: true };
}

/** The one-screen basics (name, birthday, who): one check, one write, then on to the next step. */
export async function saveBasics(input: { firstName: string; birthday: string; gender: string; interestedIn: string[] }, stepIndex: number): Promise<ActionResult> {
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
  const { error } = await sb.from("consents").insert({ user_id: user.id, version: CONSENT_VERSION, statement: CONSENT_STATEMENT });
  if (error) return DB_ERR;
  await sb.from("profiles").update({ onboarding_done_at: new Date().toISOString() }).eq("user_id", user.id).is("onboarding_done_at", null);
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

export async function setAppPaused(app: string, paused: boolean): Promise<ActionResult> {
  const c = await ctx();
  if (!c || !z.enum(APPS).safeParse(app).success) return UNAUTH;
  const { error } = await c.sb.from("app_accounts").update({ user_paused: paused, updated_at: new Date().toISOString() }).eq("user_id", c.user.id).eq("app", app);
  if (error) return DB_ERR;
  revalidatePath("/profile"); revalidatePath("/home");
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
