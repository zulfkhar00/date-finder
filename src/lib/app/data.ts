import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatMode, effectiveStatus, splitDates, type App, type AppAccountRow, type ChatMode, type DateRow, type Sender } from "./domain";

// Reads for the signed-in app. They run through the user's own session client, so Postgres RLS
// (supabase/2026-11-04-app.sql) is what limits every query to that user's rows.

export type ProfileRow = {
  user_id: string; first_name: string | null; birthday: string | null; gender: string | null; interested_in: string[];
  city: string | null; job: string | null; height_cm: number | null; interests: string[]; voice: string;
  onboarding_step: number; onboarding_done_at: string | null; notify_email: boolean; internal: boolean;
};
export type PrefRow = { age_min: number | null; age_max: number | null; distance_km: number | null; looking_for: string | null; dealbreakers: string[] };
export type MatchRow = { id: string; app: App; name: string; age: number | null; photo_path: string | null; matched_at: string; needs_user: boolean; needs_reason: string | null };
export type MessageRow = { id: string; match_id: string; sender: Sender; body: string; sent_at: string };
export type Photo = { id: string; path: string; position: number; url: string | null };

export async function getProfile(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("profiles").select("*").eq("user_id", userId).maybeSingle<ProfileRow>();
  return data;
}
export async function getPrefs(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("preferences").select("age_min, age_max, distance_km, looking_for, dealbreakers").eq("user_id", userId).maybeSingle<PrefRow>();
  return data;
}
export async function getApps(sb: SupabaseClient) {
  const { data } = await sb.from("app_accounts").select("app, status, user_paused").order("app");
  return (data ?? []) as AppAccountRow[];
}
export async function signUrls(sb: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await sb.storage.from("profile-photos").createSignedUrls(paths, 3600);
  for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}
export async function getPhotos(sb: SupabaseClient): Promise<Photo[]> {
  const { data } = await sb.from("profile_photos").select("id, path, position").order("position");
  const rows = data ?? [];
  const urls = await signUrls(sb, rows.map((r) => r.path));
  return rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null }));
}

export type ChatSummary = MatchRow & { photoUrl: string | null; last: MessageRow | null; mode: ChatMode; paused: boolean };

export async function listChats(sb: SupabaseClient): Promise<ChatSummary[]> {
  const [{ data: matches }, { data: msgs }, { data: takeovers }, apps] = await Promise.all([
    sb.from("matches").select("id, app, name, age, photo_path, matched_at, needs_user, needs_reason").order("matched_at", { ascending: false }),
    sb.from("messages").select("id, match_id, sender, body, sent_at").order("sent_at", { ascending: false }).limit(500),
    sb.from("takeovers").select("match_id, ended_at").is("ended_at", null),
    getApps(sb)
  ]);
  const rows = (matches ?? []) as MatchRow[];
  const urls = await signUrls(sb, rows.flatMap((m) => (m.photo_path ? [m.photo_path] : [])));
  const lastBy = new Map<string, MessageRow>();
  for (const m of (msgs ?? []) as MessageRow[]) if (m.sender !== "system_internal" && !lastBy.has(m.match_id)) lastBy.set(m.match_id, m);
  const pausedApps = new Set(apps.filter((a) => effectiveStatus(a) === "paused").map((a) => a.app));
  const list = rows.map((m) => ({
    ...m, photoUrl: m.photo_path ? urls.get(m.photo_path) ?? null : null, last: lastBy.get(m.id) ?? null,
    mode: chatMode((takeovers ?? []).filter((t) => t.match_id === m.id)), paused: pausedApps.has(m.app)
  }));
  return list.sort((a, b) => Date.parse(b.last?.sent_at ?? b.matched_at) - Date.parse(a.last?.sent_at ?? a.matched_at));
}

export async function getChat(sb: SupabaseClient, id: string) {
  const { data: match } = await sb.from("matches").select("id, app, name, age, photo_path, matched_at, needs_user, needs_reason").eq("id", id).maybeSingle<MatchRow>();
  if (!match) return null;
  const [{ data: messages }, { data: takeovers }, apps, urls] = await Promise.all([
    sb.from("messages").select("id, match_id, sender, body, sent_at").eq("match_id", id).order("sent_at"),
    sb.from("takeovers").select("ended_at").eq("match_id", id),
    getApps(sb),
    signUrls(sb, match.photo_path ? [match.photo_path] : [])
  ]);
  const account = apps.find((a) => a.app === match.app);
  return {
    match, photoUrl: match.photo_path ? urls.get(match.photo_path) ?? null : null,
    messages: (messages ?? []) as MessageRow[], mode: chatMode(takeovers ?? []), paused: account ? effectiveStatus(account) === "paused" : false
  };
}

export async function listDates(sb: SupabaseClient): Promise<DateRow[]> {
  const { data } = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status").neq("status", "cancelled").order("starts_at");
  return (data ?? []) as DateRow[];
}
export async function getDate(sb: SupabaseClient, id: string) {
  const { data } = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status, match_id").eq("id", id).maybeSingle<DateRow & { match_id: string | null }>();
  return data;
}

export async function getHome(sb: SupabaseClient) {
  const [apps, chats, dates] = await Promise.all([getApps(sb), listChats(sb), listDates(sb)]);
  const weekAgo = Date.now() - 7 * 86400000;
  return {
    apps, chats,
    matchesThisWeek: chats.filter((c) => Date.parse(c.matched_at) >= weekAgo).length,
    upcoming: splitDates(dates).upcoming,
    needsYou: chats.filter((c) => c.needs_user && c.mode === "ai")
  };
}
