import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PACK_VERSION, packContentSchema, type PackContent, type PackStatus } from "@/lib/starter-pack/types";
import type { ActivityRow } from "./activity";
import { chatMode, effectiveStatus, isHaltedStatus, splitDates, type App, type AppAccountRow, type ChatMode, type DateRow, type Sender } from "./domain";

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
  // client_action_reason and status_changed_at come from supabase/2026-11-20-fulfilment.sql; before it is applied, read the old columns.
  // handoff_method, login_scheduled_at and consented_at come from supabase/2026-11-21-account-runs.sql.
  const richest = await sb.from("app_accounts").select("app, status, user_paused, client_action_reason, status_changed_at, handoff_method, login_scheduled_at, consented_at").order("app");
  if (!richest.error) return (richest.data ?? []) as AppAccountRow[];
  const { data, error } = await sb.from("app_accounts").select("app, status, user_paused, client_action_reason, status_changed_at").order("app");
  if (!error) return (data ?? []) as AppAccountRow[];
  const { data: legacy } = await sb.from("app_accounts").select("app, status, user_paused").order("app");
  return (legacy ?? []) as AppAccountRow[];
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
  const pausedApps = new Set(apps.filter((a) => isHaltedStatus(effectiveStatus(a))).map((a) => a.app));
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
    messages: (messages ?? []) as MessageRow[], mode: chatMode(takeovers ?? []), paused: account ? isHaltedStatus(effectiveStatus(account)) : false
  };
}

export async function listDates(sb: SupabaseClient): Promise<DateRow[]> {
  // client_response comes from supabase/2026-11-21-account-runs.sql; before it, every booked date reads as pending.
  const withResponse = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status, client_response").neq("status", "cancelled").order("starts_at");
  if (!withResponse.error) return (withResponse.data ?? []) as DateRow[];
  const { data } = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status").neq("status", "cancelled").order("starts_at");
  return (data ?? []) as DateRow[];
}

/**
 * The rig's activity for the last 48 hours (enough for "today" in any time zone), or null when the feed does not exist yet
 * (migration not applied) or cannot be read. null reads as "no feed yet"; an empty list reads as "nothing reported today".
 */
export async function getRecentActivity(sb: SupabaseClient, nowMs = Date.now()): Promise<ActivityRow[] | null> {
  const { data, error } = await sb.from("account_activity").select("app, kind, count, match_ref, occurred_at").gte("occurred_at", new Date(nowMs - 48 * 3600000).toISOString()).order("occurred_at", { ascending: false }).limit(2000);
  if (error) return null;
  return (data ?? []) as ActivityRow[];
}
export async function getDate(sb: SupabaseClient, id: string) {
  const withResponse = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status, match_id, client_response").eq("id", id).maybeSingle<DateRow & { match_id: string | null }>();
  if (!withResponse.error) return withResponse.data;
  const { data } = await sb.from("dates").select("id, who, venue, address, starts_at, summary, status, match_id").eq("id", id).maybeSingle<DateRow & { match_id: string | null }>();
  return data;
}

export async function getHome(sb: SupabaseClient) {
  const [apps, chats, dates, activity] = await Promise.all([getApps(sb), listChats(sb), listDates(sb), getRecentActivity(sb)]);
  const weekAgo = Date.now() - 7 * 86400000;
  return {
    apps, chats, activity,
    matchesThisWeek: chats.filter((c) => Date.parse(c.matched_at) >= weekAgo).length,
    upcoming: splitDates(dates).upcoming,
    needsYou: chats.filter((c) => c.needs_user && c.mode === "ai")
  };
}

export type SetupItem = { label: string; href: string };

/** What a user skipped in onboarding that helps most. Links go to the matching Profile card. */
export async function getSetupGaps(sb: SupabaseClient, userId: string): Promise<SetupItem[]> {
  const [profile, prefs, apps, { count: photos }] = await Promise.all([
    getProfile(sb, userId), getPrefs(sb, userId), getApps(sb),
    sb.from("profile_photos").select("id", { count: "exact", head: true })
  ]);
  const gaps: SetupItem[] = [];
  if ((photos ?? 0) < 3) gaps.push({ label: (photos ?? 0) === 0 ? "Add your photos" : "Add a few more photos", href: "/profile" });
  if (!apps.length) gaps.push({ label: "Pick the apps to run", href: "/profile" });
  if (!profile?.first_name) gaps.push({ label: "Add your first name", href: "/profile" });
  if (!profile?.city || !prefs?.age_min) gaps.push({ label: "Tell us your type", href: "/profile" });
  return gaps;
}

export type StarterPackView = { status: PackStatus; content: PackContent | null; last_error: string | null; generated_at: string | null };

/** The signed-in user's starter pack (RLS: own row only). Content that no longer matches the schema counts as not ready. */
export async function getStarterPack(sb: SupabaseClient, userId: string): Promise<StarterPackView | null> {
  const { data } = await sb.from("starter_packs").select("status, content, last_error, generated_at").eq("user_id", userId).eq("version", PACK_VERSION).maybeSingle();
  if (!data) return null;
  const parsed = data.content ? packContentSchema.safeParse(data.content) : null;
  const content = parsed?.success ? parsed.data : null;
  return { status: content ? "ready" : data.status === "ready" ? "pending" : (data.status as PackStatus), content, last_error: data.last_error, generated_at: data.generated_at };
}

/** The server clock for a page render. A function of its own so pages read it without calling an impure global inside a component. */
export const serverNow = (): number => Date.now();
