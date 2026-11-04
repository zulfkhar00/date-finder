import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildDateBookedEmail, buildNeedsYouEmail } from "@/lib/app-emails";
import { APPS, SEND_REFUSALS, canAiSend, chatMode, effectiveStatus, encodeSystemEvent, type AppStatus, type SystemEvent } from "@/lib/app/domain";
import { sendAppEmail } from "@/lib/email";
import { parseSiteUrl } from "@/lib/admin-config";

// The automation seam (docs/automation.md). Everything a worker, or the admin console, may do to a
// client's account goes through these functions with the service-role client. Both the HTTP routes
// under /api/automation/v1 and the /admin/clients forms call them, so the rules (no AI sends during a
// takeover or a pause, idempotent ingest, notifications) are enforced in exactly one place.

export type Failure = { ok: false; status: number; code: string; message: string };
export type Result<T> = ({ ok: true } & T) | Failure;
const fail = (status: number, code: string, message: string): Failure => ({ ok: false, status, code, message });

const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true });

export const schemas = {
  appStatus: z.object({ status: z.enum(["setting_up", "live", "paused"]) }),
  match: z.object({
    app: z.enum(APPS), externalId: z.string().min(1).max(200).optional(),
    name: z.string().trim().min(1).max(80), age: z.number().int().min(18).max(99).nullable().optional(),
    matchedAt: iso.optional()
  }),
  message: z.object({
    sender: z.enum(["match", "as_user_ai"]), body: z.string().trim().min(1).max(4000),
    sentAt: iso.optional(), externalId: z.string().min(1).max(200).optional()
  }),
  needsYou: z.object({ needsUser: z.boolean(), reason: z.string().trim().max(200).optional() }),
  date: z.object({
    matchId: uuid.nullable().optional(), who: z.string().trim().min(1).max(80), venue: z.string().trim().min(1).max(160),
    address: z.string().trim().max(240).nullable().optional(), startsAt: iso, summary: z.string().trim().max(600).nullable().optional()
  })
};

function siteUrl(): string {
  return parseSiteUrl(process.env.SITE_URL) ?? "https://www.noswipe.app";
}

async function notifyUser(sb: SupabaseClient, userId: string, kind: "date" | "needs", info: { who: string; venue?: string; startsAt?: string; path: string }) {
  try {
    const { data: profile } = await sb.from("profiles").select("notify_email").eq("user_id", userId).maybeSingle();
    if (!profile || profile.notify_email === false) return;
    const { data: auth } = await sb.auth.admin.getUserById(userId);
    const to = auth.user?.email;
    if (!to) return;
    const link = `${siteUrl()}${info.path}`;
    const email = kind === "date"
      ? buildDateBookedEmail({ who: info.who, venue: info.venue ?? "", startsAt: info.startsAt ?? new Date().toISOString(), link })
      : buildNeedsYouEmail({ who: info.who, link });
    await sendAppEmail(to, email, kind === "date" ? "Date booked email" : "Needs-you email");
  } catch (error) {
    console.error("Notification failed", error instanceof Error ? error.name : "unknown");
  }
}

export async function setAppStatus(sb: SupabaseClient, userId: string, app: string, input: unknown): Promise<Result<{ app: string; status: AppStatus }>> {
  const a = z.enum(APPS).safeParse(app);
  const p = schemas.appStatus.safeParse(input);
  if (!a.success || !p.success) return fail(400, "invalid", "Unknown app or status.");
  const { error } = await sb.from("app_accounts").upsert({ user_id: userId, app: a.data, status: p.data.status, updated_at: new Date().toISOString() }, { onConflict: "user_id,app" });
  if (error) return fail(500, "db", "Could not save the app status.");
  return { ok: true, app: a.data, status: p.data.status };
}

export async function addMatch(sb: SupabaseClient, userId: string, input: unknown): Promise<Result<{ matchId: string; created: boolean }>> {
  const p = schemas.match.safeParse(input);
  if (!p.success) return fail(400, "invalid", "Invalid match.");
  const m = p.data;
  if (m.externalId) {
    const { data: existing } = await sb.from("matches").select("id").eq("user_id", userId).eq("app", m.app).eq("external_id", m.externalId).maybeSingle();
    if (existing) return { ok: true, matchId: existing.id, created: false };
  }
  const { data, error } = await sb.from("matches").insert({
    user_id: userId, app: m.app, name: m.name, age: m.age ?? null, external_id: m.externalId ?? null, matched_at: m.matchedAt ?? new Date().toISOString()
  }).select("id").single();
  if (error || !data) return fail(500, "db", "Could not add the match.");
  return { ok: true, matchId: data.id, created: true };
}

export async function chatState(sb: SupabaseClient, matchId: string) {
  const { data: match } = await sb.from("matches").select("id, user_id, app, name").eq("id", matchId).maybeSingle();
  if (!match) return null;
  const [{ data: takeovers }, { data: account }] = await Promise.all([
    sb.from("takeovers").select("ended_at").eq("match_id", matchId),
    sb.from("app_accounts").select("status, user_paused").eq("user_id", match.user_id).eq("app", match.app).maybeSingle()
  ]);
  const mode = chatMode(takeovers ?? []);
  const appStatus = account ? effectiveStatus(account) : "setting_up";
  return { match, mode, appStatus };
}

/** Records a message. The match's messages always go in; AI sends are refused during a takeover or a pause. */
export async function addMessage(sb: SupabaseClient, matchId: string, input: unknown): Promise<Result<{ messageId: string; created: boolean }>> {
  if (!uuid.safeParse(matchId).success) return fail(404, "not_found", "Unknown chat.");
  const p = schemas.message.safeParse(input);
  if (!p.success) return fail(400, "invalid", "Invalid message.");
  const state = await chatState(sb, matchId);
  if (!state) return fail(404, "not_found", "Unknown chat.");
  const m = p.data;
  if (m.sender === "as_user_ai") {
    const decision = canAiSend(state.mode, state.appStatus);
    if (!decision.ok) return fail(409, decision.reason, SEND_REFUSALS[decision.reason]);
  }
  if (m.externalId) {
    const { data: existing } = await sb.from("messages").select("id").eq("match_id", matchId).eq("external_id", m.externalId).maybeSingle();
    if (existing) return { ok: true, messageId: existing.id, created: false };
  }
  const { data, error } = await sb.from("messages").insert({
    match_id: matchId, user_id: state.match.user_id, sender: m.sender, body: m.body, sent_at: m.sentAt ?? new Date().toISOString(), external_id: m.externalId ?? null,
    delivered_at: new Date().toISOString()
  }).select("id").single();
  if (error || !data) {
    // The database guard is the backstop if a takeover started between the check and the insert.
    if (error?.code === "P0001") return fail(409, "taken_over", SEND_REFUSALS.taken_over);
    return fail(500, "db", "Could not add the message.");
  }
  return { ok: true, messageId: data.id, created: true };
}

/** Writes an internal notice into the user's own thread. It is never sent to the match or returned to the worker. */
export async function addSystemEvent(sb: SupabaseClient, matchId: string, userId: string, event: SystemEvent) {
  const { error } = await sb.from("messages").insert({ match_id: matchId, user_id: userId, sender: "system_internal", body: encodeSystemEvent(event), delivered_at: new Date().toISOString() });
  if (error) console.error("System notice failed", error.code);
}

export async function setNeedsYou(sb: SupabaseClient, matchId: string, input: unknown): Promise<Result<{ needsUser: boolean }>> {
  const p = schemas.needsYou.safeParse(input);
  if (!uuid.safeParse(matchId).success || !p.success) return fail(400, "invalid", "Invalid request.");
  const { data: before } = await sb.from("matches").select("user_id, name, needs_user").eq("id", matchId).maybeSingle();
  if (!before) return fail(404, "not_found", "Unknown chat.");
  const { error } = await sb.from("matches").update({ needs_user: p.data.needsUser, needs_reason: p.data.needsUser ? (p.data.reason ?? null) : null }).eq("id", matchId);
  if (error) return fail(500, "db", "Could not update the chat.");
  if (p.data.needsUser && !before.needs_user) await notifyUser(sb, before.user_id, "needs", { who: before.name, path: `/chats/${matchId}` });
  return { ok: true, needsUser: p.data.needsUser };
}

export async function bookDate(sb: SupabaseClient, userId: string, input: unknown): Promise<Result<{ dateId: string }>> {
  const p = schemas.date.safeParse(input);
  if (!p.success) return fail(400, "invalid", "Invalid date.");
  const d = p.data;
  if (d.matchId) {
    const { data: match } = await sb.from("matches").select("user_id").eq("id", d.matchId).maybeSingle();
    if (!match || match.user_id !== userId) return fail(404, "not_found", "Unknown chat for this client.");
  }
  const { data, error } = await sb.from("dates").insert({
    user_id: userId, match_id: d.matchId ?? null, who: d.who, venue: d.venue, address: d.address ?? null, starts_at: d.startsAt, summary: d.summary ?? null
  }).select("id").single();
  if (error || !data) return fail(500, "db", "Could not book the date.");
  if (d.matchId) await addSystemEvent(sb, d.matchId, userId, { kind: "date_booked", startsAt: d.startsAt, venue: d.venue });
  await notifyUser(sb, userId, "date", { who: d.who, venue: d.venue, startsAt: d.startsAt, path: `/dates/${data.id}` });
  return { ok: true, dateId: data.id };
}

/** User-typed messages that the worker still has to send inside the dating app. */
export async function listOutbox(sb: SupabaseClient, limit = 50) {
  const { data, error } = await sb.from("messages")
    .select("id, match_id, user_id, body, created_at, matches(app, external_id, name)")
    .eq("sender", "user").is("delivered_at", null).order("created_at").limit(Math.min(limit, 200));
  if (error) return fail(500, "db", "Could not read the outbox.");
  return { ok: true as const, messages: data ?? [] };
}

export async function ackOutbox(sb: SupabaseClient, messageId: string): Promise<Result<{ acked: true }>> {
  if (!uuid.safeParse(messageId).success) return fail(404, "not_found", "Unknown message.");
  const { data, error } = await sb.from("messages").update({ delivered_at: new Date().toISOString() }).eq("id", messageId).eq("sender", "user").is("delivered_at", null).select("id").maybeSingle();
  if (error) return fail(500, "db", "Could not acknowledge.");
  if (!data) return fail(404, "not_found", "Unknown or already acknowledged.");
  return { ok: true, acked: true };
}

export async function clientBrief(sb: SupabaseClient, userId: string) {
  if (!uuid.safeParse(userId).success) return fail(404, "not_found", "Unknown client.");
  const [{ data: profile }, { data: prefs }, { data: apps }, { data: photos }, { data: consent }] = await Promise.all([
    sb.from("profiles").select("first_name, birthday, gender, interested_in, city, job, height_cm, interests, voice, onboarding_done_at, internal").eq("user_id", userId).maybeSingle(),
    sb.from("preferences").select("age_min, age_max, distance_km, looking_for, dealbreakers").eq("user_id", userId).maybeSingle(),
    sb.from("app_accounts").select("app, status, user_paused").eq("user_id", userId),
    sb.from("profile_photos").select("path, position").eq("user_id", userId).order("position"),
    sb.from("consents").select("version, accepted_at").eq("user_id", userId).order("accepted_at", { ascending: false }).limit(1)
  ]);
  if (!profile) return fail(404, "not_found", "Unknown client.");
  const signed = await Promise.all((photos ?? []).map(async (p) => {
    const { data } = await sb.storage.from("profile-photos").createSignedUrl(p.path, 3600);
    return { position: p.position, url: data?.signedUrl ?? null };
  }));
  return {
    ok: true as const,
    client: {
      id: userId, profile, preferences: prefs,
      apps: (apps ?? []).map((a) => ({ app: a.app, status: a.status, userPaused: a.user_paused, effectiveStatus: effectiveStatus(a) })),
      photos: signed, consent: consent?.[0] ?? null
    }
  };
}

export async function listClients(sb: SupabaseClient, filter: { status?: string; limit?: number }) {
  let q = sb.from("app_accounts").select("user_id, app, status, user_paused").limit(Math.min(filter.limit ?? 200, 500));
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) return fail(500, "db", "Could not list clients.");
  return { ok: true as const, accounts: (data ?? []).map((a) => ({ userId: a.user_id, app: a.app, status: a.status, userPaused: a.user_paused, effectiveStatus: effectiveStatus(a) })) };
}
