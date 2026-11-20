import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APPS, type App, type AppStatus } from "@/lib/app/domain";
import { parseSiteUrl } from "@/lib/admin-config";
import { internalEmailReason, isStripeTestSession } from "@/lib/internal-traffic";
import { opsConfigured, sendOps } from "@/lib/ops-notify";
import { PACK_VERSION } from "@/lib/starter-pack/types";
import { isUndefinedRelation, usersWithFlags } from "@/lib/starter-pack/photo-flags";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { alertKey, buildRow, needsAlert, opsLine, parseNote, parseStatusChange, type QueueApp, type QueueInput, type QueueRow } from "./core";

// Server half of the fulfilment workflow (supabase/2026-11-20-fulfilment.sql). Service role only. Nothing here logs emails,
// names, reasons or notes: errors are reduced to a Postgres code.

type Admin = SupabaseClient;

export type FulfilmentEvent = { id: string; at: string; actor: string; action: string; app: string | null; from_status: string | null; to_status: string | null; reason: string | null; note: string | null };
export type Failure = { ok: false; status: number; code: string; message: string };

const SETUP_HINT = "Run supabase/2026-11-20-fulfilment.sql first.";

async function logEvent(sb: Admin, e: { userId: string; app?: App | null; actor: string; action: "status" | "note" | "alert"; from?: string | null; to?: string | null; reason?: string | null; note?: string | null; dedupeKey?: string }): Promise<{ ok: boolean; duplicate: boolean; code?: string }> {
  const { error } = await sb.from("fulfilment_events").insert({
    user_id: e.userId, app: e.app ?? null, actor: e.actor.slice(0, 254), action: e.action, from_status: e.from ?? null, to_status: e.to ?? null,
    reason: e.reason ?? null, note: e.note ?? null, dedupe_key: e.dedupeKey ?? null
  });
  if (error) {
    if (error.code === "23505") return { ok: false, duplicate: true };
    console.error("Fulfilment event failed", error.code);
    return { ok: false, duplicate: false, code: error.code };
  }
  return { ok: true, duplicate: false };
}

export async function listEvents(sb: Admin, userId: string, limit = 50): Promise<{ events: FulfilmentEvent[]; setupNeeded: boolean }> {
  const { data, error } = await sb.from("fulfilment_events").select("id, at, actor, action, app, from_status, to_status, reason, note").eq("user_id", userId).neq("action", "alert").order("at", { ascending: false }).limit(limit);
  if (error) { if (!isUndefinedRelation(error)) console.error("Fulfilment events read failed", error.code); return { events: [], setupNeeded: isUndefinedRelation(error) }; }
  return { events: (data ?? []) as FulfilmentEvent[], setupNeeded: false };
}

/**
 * Sets one app's status, the reason the client reads, and logs who did it. `actor` is the admin's email, or "automation" for the
 * worker API. Before the migration only the three original statuses save (without the new columns); the new ones answer with a hint.
 */
export async function changeAppStatus(sb: Admin, actor: string, userId: string, app: string, input: { status: unknown; reason?: unknown; note?: unknown }): Promise<{ ok: true; app: App; status: AppStatus; logged: boolean } | Failure> {
  if (!(APPS as readonly string[]).includes(app)) return { ok: false, status: 400, code: "invalid", message: "Unknown app." };
  const parsed = parseStatusChange(input, { allowLegacy: true });
  if (!parsed.ok) return { ok: false, status: 400, code: "invalid", message: parsed.error };
  const { status, reason } = parsed.change;
  const note = input.note === undefined || input.note === null || input.note === "" ? null : parseNote(input.note);
  if (input.note && !note) return { ok: false, status: 400, code: "invalid", message: "Notes are 1 to 2000 characters." };
  const nowIso = new Date().toISOString();
  const { data: before, error: readError } = await sb.from("app_accounts").select("status").eq("user_id", userId).eq("app", app).maybeSingle();
  if (readError) { console.error("Status read failed", readError.code); return { ok: false, status: 500, code: "db", message: "Could not read the app status." }; }
  const row = { user_id: userId, app, status, client_action_reason: reason, status_changed_at: nowIso, updated_at: nowIso };
  let { error } = await sb.from("app_accounts").upsert(row, { onConflict: "user_id,app" });
  if (error && isUndefinedRelation(error)) {
    if (!["setting_up", "live", "paused"].includes(status)) return { ok: false, status: 503, code: "migration", message: `That status needs a database update. ${SETUP_HINT}` };
    ({ error } = await sb.from("app_accounts").upsert({ user_id: userId, app, status, updated_at: nowIso }, { onConflict: "user_id,app" }));
  }
  if (error) { console.error("Status save failed", error.code); return { ok: false, status: 500, code: "db", message: error.code === "23514" ? `That status is not allowed by the database yet. ${SETUP_HINT}` : "Could not save the app status." }; }
  const log = await logEvent(sb, { userId, app: app as App, actor, action: "status", from: (before?.status as string | undefined) ?? null, to: status, reason, note });
  return { ok: true, app: app as App, status, logged: log.ok };
}

export async function addNoteEvent(sb: Admin, actor: string, userId: string, noteInput: unknown, app?: string): Promise<{ ok: true } | Failure> {
  const note = parseNote(noteInput);
  if (!note) return { ok: false, status: 400, code: "invalid", message: "Write a note (up to 2000 characters)." };
  const log = await logEvent(sb, { userId, app: (APPS as readonly string[]).includes(app ?? "") ? (app as App) : null, actor, action: "note", note });
  return log.ok ? { ok: true } : { ok: false, status: 500, code: "db", message: `Could not save the note. ${SETUP_HINT}` };
}

// ---------- the queue ----------

export type Queue = { rows: QueueRow[]; setupNeeded: { events: boolean }; truncated: boolean };
const PROFILE_LIMIT = 1000;

type ProfileRow = { user_id: string; first_name: string | null; internal: boolean; onboarding_done_at: string; created_at: string; report_hold?: string | null };
type ReservationRow = { email: string; status: string; paid_at: string | null; created_at: string; stripe_checkout_session_id: string | null; billing_country?: string | null };
type AppRow = { user_id: string; app: App; status: AppStatus; user_paused: boolean; client_action_reason?: string | null; status_changed_at?: string | null };

export async function loadQueue(sb: Admin = getSupabaseAdmin(), now: Date = new Date()): Promise<Queue> {
  const setupNeeded = { events: false };
  // Onboarded users only. report_hold exists once supabase/2026-11-20-reports.sql is applied.
  let profiles: ProfileRow[] = [];
  for (const columns of ["user_id, first_name, internal, onboarding_done_at, created_at, report_hold", "user_id, first_name, internal, onboarding_done_at, created_at"]) {
    const { data, error } = await sb.from("profiles").select(columns).not("onboarding_done_at", "is", null).order("onboarding_done_at", { ascending: true }).limit(PROFILE_LIMIT);
    if (error) { if (isUndefinedRelation(error)) continue; console.error("Queue profiles read failed", error.code); return { rows: [], setupNeeded, truncated: false }; }
    profiles = (data ?? []) as unknown as ProfileRow[];
    break;
  }
  const real = profiles.filter((p) => !p.internal);
  if (!real.length) return { rows: [], setupNeeded, truncated: false };

  const emails = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error("Queue users read failed", error.status ?? "unknown"); break; }
    for (const u of data.users) if (u.email) emails.set(u.id, u.email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  // Same exclusion as the rest of admin: founders and test addresses are not customers.
  const eligible = real.filter((p) => { const email = emails.get(p.user_id); return !email || !internalEmailReason(email); });
  const ids = eligible.map((p) => p.user_id);
  if (!ids.length) return { rows: [], setupNeeded, truncated: profiles.length >= PROFILE_LIMIT };
  const emailList = [...new Set(ids.flatMap((id) => (emails.get(id) ? [emails.get(id)!] : [])))];

  const reservations: ReservationRow[] = [];
  for (const columns of ["email, status, paid_at, created_at, stripe_checkout_session_id, billing_country", "email, status, paid_at, created_at, stripe_checkout_session_id"]) {
    const { data, error } = await sb.from("reservations").select(columns).in("email", emailList).order("created_at", { ascending: false });
    if (error) { if (isUndefinedRelation(error)) continue; console.error("Queue reservations read failed", error.code); break; }
    reservations.push(...((data ?? []) as unknown as ReservationRow[]));
    break;
  }
  const funnelCountry = new Map<string, string>();
  const keys = reservations.flatMap((r) => (r.stripe_checkout_session_id ? [`checkout_created:${r.stripe_checkout_session_id}`] : []));
  if (keys.length) {
    const { data, error } = await sb.from("funnel_events").select("dedupe_key, country").in("dedupe_key", keys);
    if (!error) for (const r of data ?? []) if (r.country) funnelCountry.set(r.dedupe_key as string, r.country as string);
  }

  const [appsRes, packsRes, photosRes, flags, eventsRes] = await Promise.all([
    sb.from("app_accounts").select("user_id, app, status, user_paused, client_action_reason, status_changed_at").in("user_id", ids),
    sb.from("starter_packs").select("user_id, status").in("user_id", ids).eq("version", PACK_VERSION),
    sb.from("profile_photos").select("user_id").in("user_id", ids).is("deleted_at", null),
    usersWithFlags(sb),
    sb.from("fulfilment_events").select("user_id, at").in("user_id", ids).neq("action", "alert").order("at", { ascending: false }).limit(5000)
  ]);
  let appRows = (appsRes.data ?? []) as unknown as AppRow[];
  if (appsRes.error) appRows = ((await sb.from("app_accounts").select("user_id, app, status, user_paused").in("user_id", ids)).data ?? []) as unknown as AppRow[];
  let photoRows = photosRes.data ?? [];
  if (photosRes.error) photoRows = (await sb.from("profile_photos").select("user_id").in("user_id", ids)).data ?? [];
  if (eventsRes.error && isUndefinedRelation(eventsRes.error)) setupNeeded.events = true;
  const lastEvent = new Map<string, string>();
  for (const e of eventsRes.data ?? []) if (!lastEvent.has(e.user_id as string)) lastEvent.set(e.user_id as string, e.at as string);
  const packStatus = new Map((packsRes.data ?? []).map((p) => [p.user_id as string, p.status as string]));
  const photoCount = new Map<string, number>();
  for (const p of photoRows) photoCount.set(p.user_id as string, (photoCount.get(p.user_id as string) ?? 0) + 1);

  const rows = eligible.map((p) => {
    const email = emails.get(p.user_id) ?? "";
    const mine = reservations.filter((r) => r.email === email);
    const paidRes = mine.find((r) => r.status === "paid" && !isStripeTestSession(r.stripe_checkout_session_id));
    const countryOf = (r: ReservationRow) => r.billing_country ?? funnelCountry.get(`checkout_created:${r.stripe_checkout_session_id}`) ?? null;
    const country = (paidRes ? countryOf(paidRes) : null) ?? mine.map(countryOf).find(Boolean) ?? null;
    const apps: QueueApp[] = appRows.filter((a) => a.user_id === p.user_id).sort((a, b) => APPS.indexOf(a.app) - APPS.indexOf(b.app)).map((a) => ({
      app: a.app, status: a.status, userPaused: a.user_paused, reason: a.client_action_reason ?? null, changedAt: a.status_changed_at ?? null
    }));
    const hold = p.report_hold === "paused" || p.report_hold === "closed" ? p.report_hold : null;
    const input: QueueInput = {
      userId: p.user_id, firstName: p.first_name, email, createdAt: p.created_at, onboardingDoneAt: p.onboarding_done_at,
      paid: !!paidRes, paidAt: paidRes?.paid_at ?? null, country, apps, packStatus: packStatus.get(p.user_id) ?? null,
      photoCount: photoCount.get(p.user_id) ?? 0, flaggedPhotos: flags.get(p.user_id) ?? 0, hold, lastEventAt: lastEvent.get(p.user_id) ?? null
    };
    return buildRow(input, now);
  });
  return { rows, setupNeeded, truncated: profiles.length >= PROFILE_LIMIT };
}

// ---------- ops alert ----------

export type SweepResult = { checked: number; due: number; alerted: number; skipped?: "ops_not_configured" | "not_set_up" };

/**
 * One ops line per paid client the team has not touched for more than 24 h, at most one per client per UTC day (claimed in the
 * database, so overlapping runs cannot double up). The line carries hours, app names and an admin link: no name, no email.
 * A claim whose send failed is released, so the next run retries. Counts only in the return value.
 */
export async function runFulfilmentSweep(sb: Admin = getSupabaseAdmin(), now: Date = new Date()): Promise<SweepResult> {
  const queue = await loadQueue(sb, now);
  const due = queue.rows.filter(needsAlert);
  if (queue.setupNeeded.events) return { checked: queue.rows.length, due: due.length, alerted: 0, skipped: "not_set_up" };
  if (!opsConfigured()) return { checked: queue.rows.length, due: due.length, alerted: 0, skipped: "ops_not_configured" };
  const origin = parseSiteUrl(process.env.SITE_URL) ?? "";
  let alerted = 0;
  for (const row of due) {
    const key = alertKey(row.userId, now);
    const claim = await logEvent(sb, { userId: row.userId, actor: "system", action: "alert", dedupeKey: key });
    if (!claim.ok) continue;
    const sent = await sendOps("signups", opsLine(row, `${origin}/admin/clients/${row.userId}`));
    if (sent) alerted += 1;
    else await sb.from("fulfilment_events").delete().eq("dedupe_key", key);
  }
  return { checked: queue.rows.length, due: due.length, alerted };
}
