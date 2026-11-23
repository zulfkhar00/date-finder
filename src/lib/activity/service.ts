import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { batchSchema, eventSchema, occurredAtOk, type ActivityEvent } from "@/lib/app/activity";
import { APPS, effectiveStatus, type App, type AppStatus } from "@/lib/app/domain";
import * as core from "@/lib/automation/core";
import { changeAppStatus } from "@/lib/fulfilment/service";
import { isUndefinedRelation } from "@/lib/starter-pack/photo-flags";
import { normalizeTimezone } from "@/lib/timezone";

// Server half of the activity feed (supabase/2026-11-21-account-runs.sql). Service role only. The phone rig POSTs events, the
// client reads their own rows on Home. Nothing here logs ids, names, reasons or message text: errors reduce to a Postgres code.

type Admin = SupabaseClient;
export type Failure = core.Failure;
const SETUP_HINT = "Run supabase/2026-11-21-account-runs.sql first.";
const uuid = z.string().uuid();

export type EventResult =
  | { index: number; idempotencyKey: string | null; status: "created" | "duplicate" }
  | { index: number; idempotencyKey: string | null; status: "rejected"; code: string; message: string };

/**
 * Records a batch of events for one client. Each event is judged on its own and answered in order, so the rig can retry
 * only what failed. A repeated idempotencyKey is a no-op ("duplicate"), never a second count, a second date or a second email.
 * Events for an app the client never connected, or events dated outside [now - 7 days, now + 5 minutes], are rejected.
 */
export async function ingestEvents(sb: Admin, userId: string, body: unknown, now: Date = new Date()): Promise<{ ok: true; results: EventResult[]; created: number; duplicates: number; rejected: number } | Failure> {
  if (!uuid.safeParse(userId).success) return { ok: false, status: 404, code: "not_found", message: "Unknown client." };
  const batch = batchSchema.safeParse(body);
  if (!batch.success) return { ok: false, status: 400, code: "invalid", message: "Send {\"events\": [1 to 200 events]}." };
  const { data: accounts, error: accountsError } = await sb.from("app_accounts").select("app, status, user_paused").eq("user_id", userId);
  if (accountsError) { console.error("Activity accounts read failed", accountsError.code); return { ok: false, status: 500, code: "db", message: "Could not read the client's apps." }; }
  const byApp = new Map((accounts ?? []).map((a) => [a.app as App, a as { app: App; status: AppStatus; user_paused: boolean }]));
  const results: EventResult[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of batch.data.events.entries()) {
    const keyOf = typeof (raw as { idempotencyKey?: unknown } | null)?.idempotencyKey === "string" ? String((raw as { idempotencyKey: string }).idempotencyKey) : null;
    const reject = (code: string, message: string): EventResult => ({ index, idempotencyKey: keyOf, status: "rejected", code, message });
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) { results.push(reject("invalid", "Invalid event.")); continue; }
    const e = parsed.data;
    if (!byApp.has(e.app)) { results.push(reject("no_account", `The client has not connected ${e.app}.`)); continue; }
    if (!occurredAtOk(e.occurredAt, now.getTime())) { results.push(reject("bad_time", "occurredAt is more than 5 minutes ahead or more than 7 days old.")); continue; }
    if (seen.has(e.idempotencyKey)) { results.push({ index, idempotencyKey: e.idempotencyKey, status: "duplicate" }); continue; }
    seen.add(e.idempotencyKey);
    const outcome = await applyEvent(sb, userId, e, byApp.get(e.app)!, now);
    if (outcome.ok) results.push({ index, idempotencyKey: e.idempotencyKey, status: outcome.created ? "created" : "duplicate" });
    else if (outcome.status === 503) return outcome;
    else results.push(reject(outcome.code, outcome.message));
  }
  const count = (s: EventResult["status"]) => results.filter((r) => r.status === s).length;
  return { ok: true, results, created: count("created"), duplicates: count("duplicate"), rejected: count("rejected") };
}

async function applyEvent(sb: Admin, userId: string, e: ActivityEvent, account: { status: AppStatus; user_paused: boolean }, now: Date): Promise<{ ok: true; created: boolean } | Failure> {
  const fail = (status: number, code: string, message: string): Failure => ({ ok: false, status, code, message });
  if (e.kind === "date_booked") {
    // The date is booked first, under the rig's own id, so a retry after a half-finished request completes the rest instead of losing it.
    let matchId: string | null = null;
    if (e.matchRef) {
      const { data } = await sb.from("matches").select("id").eq("user_id", userId).eq("app", e.app).eq("external_id", e.matchRef).maybeSingle();
      matchId = (data?.id as string | undefined) ?? null;
    }
    const booked = await core.bookDate(sb, userId, { matchId, who: e.who, venue: e.venue, address: e.address ?? null, startsAt: e.startsAt, summary: e.summary ?? null }, `activity:${e.idempotencyKey}`);
    if (!booked.ok) return booked;
  }
  const row = {
    user_id: userId, app: e.app, kind: e.kind, count: e.kind === "swipes" ? e.count : 1,
    match_ref: "matchRef" in e ? e.matchRef ?? null : null, reason: e.kind === "needs_you" ? e.reason : null,
    occurred_at: e.occurredAt ?? now.toISOString(), idempotency_key: e.idempotencyKey
  };
  const { error } = await sb.from("account_activity").insert(row);
  if (error) {
    if (error.code === "23505") return { ok: true, created: false };
    if (isUndefinedRelation(error)) return fail(503, "migration", `The activity feed is not set up. ${SETUP_HINT}`);
    console.error("Activity insert failed", error.code);
    return fail(500, "db", "Could not record the event.");
  }
  if (e.kind === "needs_you") {
    // Only an app that is still in play flips to "needs you". A pause or closure the client or team chose is never overridden by the rig.
    const s = effectiveStatus(account);
    if (s === "setting_up" || s === "active" || s === "live") {
      await changeAppStatus(sb, "automation", userId, e.app, { status: "needs_client_action", reason: e.reason });
    }
  }
  return { ok: true, created: true };
}

// ---------- what the rig should be running ----------

export type RunRow = {
  userId: string; app: App; phoneId: string | null; accountRef: string | null; status: AppStatus; userPaused: boolean; effectiveStatus: AppStatus;
  /** The client finished onboarding (profiles.onboarding_done_at is set). */
  onboarded: boolean; held: boolean;
  /** The client's IANA time zone (profiles.timezone, captured at onboarding or set by an operator), or null when unknown. */
  timezone: string | null;
  /** True only when onboarding is finished, an operator marked the app active, nobody paused it, no report hold applies and a phone is assigned. */
  shouldRun: boolean;
};

/** The rig's job list: every app account with its phone assignment and a plain shouldRun flag. Optional filter by phone. */
export async function listRuns(sb: Admin, filter: { phoneId?: string; limit?: number } = {}): Promise<{ ok: true; runs: RunRow[] } | Failure> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  const accounts = await sb.from("app_accounts").select("user_id, app, status, user_paused").limit(limit);
  if (accounts.error) { console.error("Runs read failed", accounts.error.code); return { ok: false, status: 500, code: "db", message: "Could not list runs." }; }
  const runsRes = await sb.from("account_runs").select("user_id, app, phone_id, account_ref");
  const runs = new Map<string, { phone_id: string | null; account_ref: string | null }>();
  if (runsRes.error && !isUndefinedRelation(runsRes.error)) { console.error("Run assignments read failed", runsRes.error.code); return { ok: false, status: 500, code: "db", message: "Could not list runs." }; }
  for (const r of runsRes.data ?? []) runs.set(`${r.user_id}:${r.app}`, { phone_id: r.phone_id as string | null, account_ref: r.account_ref as string | null });
  const rows = (accounts.data ?? []) as unknown as { user_id: string; app: App; status: AppStatus; user_paused: boolean }[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const held = await core.reportHeldUsers(sb, userIds);
  const onboarded = new Set<string>();
  const zones = new Map<string, string>();
  if (userIds.length) {
    const profiles = await sb.from("profiles").select("user_id, onboarding_done_at, timezone").in("user_id", userIds);
    if (profiles.error) { console.error("Profiles read failed", profiles.error.code); return { ok: false, status: 500, code: "db", message: "Could not list runs." }; }
    for (const p of profiles.data ?? []) {
      if (p.onboarding_done_at) onboarded.add(p.user_id as string);
      const tz = normalizeTimezone(p.timezone);
      if (tz) zones.set(p.user_id as string, tz);
    }
  }
  const out: RunRow[] = rows.map((a) => {
    const run = runs.get(`${a.user_id}:${a.app}`);
    const eff = effectiveStatus(a);
    const isHeld = held.has(a.user_id);
    const done = onboarded.has(a.user_id);
    return {
      userId: a.user_id, app: a.app, phoneId: run?.phone_id ?? null, accountRef: run?.account_ref ?? null, status: a.status, userPaused: a.user_paused, effectiveStatus: eff,
      onboarded: done, held: isHeld, timezone: zones.get(a.user_id) ?? null,
      shouldRun: done && !isHeld && (eff === "active" || eff === "live") && Boolean(run?.phone_id)
    };
  }).filter((r) => (filter.phoneId ? r.phoneId === filter.phoneId : true));
  return { ok: true, runs: out };
}

// ---------- admin: the Run panel ----------

export type RunAssignment = { phoneId: string | null; accountRef: string | null; updatedBy: string | null; updatedAt: string | null };
export type ActivityTotals = { swipes: number; matches: number; chats: number; dates: number; lastAt: string | null };

export async function getRunPanel(sb: Admin, userId: string): Promise<{ assignments: Record<string, RunAssignment>; totals: Record<string, ActivityTotals>; recent: { app: App; kind: string; count: number; reason: string | null; occurred_at: string }[]; setupNeeded: boolean }> {
  const [runs, activity] = await Promise.all([
    sb.from("account_runs").select("app, phone_id, account_ref, updated_by, updated_at").eq("user_id", userId),
    sb.from("account_activity").select("app, kind, count, reason, occurred_at").eq("user_id", userId).gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).order("occurred_at", { ascending: false }).limit(1000)
  ]);
  const setupNeeded = isUndefinedRelation(runs.error) || isUndefinedRelation(activity.error);
  const assignments: Record<string, RunAssignment> = {};
  for (const r of runs.data ?? []) assignments[r.app as string] = { phoneId: r.phone_id as string | null, accountRef: r.account_ref as string | null, updatedBy: r.updated_by as string | null, updatedAt: r.updated_at as string | null };
  const totals: Record<string, ActivityTotals> = {};
  const rows = (activity.data ?? []) as unknown as { app: App; kind: string; count: number; reason: string | null; occurred_at: string }[];
  for (const a of rows) {
    const t = (totals[a.app] ??= { swipes: 0, matches: 0, chats: 0, dates: 0, lastAt: null });
    if (a.kind === "swipes") t.swipes += a.count; else if (a.kind === "match") t.matches += a.count; else if (a.kind === "chat") t.chats += 1; else if (a.kind === "date_booked") t.dates += 1;
    if (!t.lastAt || a.occurred_at > t.lastAt) t.lastAt = a.occurred_at;
  }
  return { assignments, totals, recent: rows.slice(0, 15), setupNeeded };
}

const runSchema = z.object({
  phoneId: z.string().trim().max(80).nullable().optional(),
  accountRef: z.string().trim().max(120).nullable().optional()
});

/** Assigns the phone and the internal account label that run this client's app. */
export async function setRun(sb: Admin, actor: string, userId: string, app: string, input: unknown): Promise<{ ok: true } | Failure> {
  if (!(APPS as readonly string[]).includes(app) || !uuid.safeParse(userId).success) return { ok: false, status: 400, code: "invalid", message: "Unknown app." };
  const p = runSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, code: "invalid", message: "Phone and account labels are up to 80 and 120 characters." };
  const nowIso = new Date().toISOString();
  const phoneId = p.data.phoneId || null;
  const accountRef = p.data.accountRef || null;
  const { error } = await sb.from("account_runs").upsert({ user_id: userId, app, phone_id: phoneId, account_ref: accountRef, updated_by: actor.slice(0, 254), updated_at: nowIso }, { onConflict: "user_id,app" });
  if (error) {
    if (isUndefinedRelation(error)) return { ok: false, status: 503, code: "migration", message: `Phone assignment is not set up. ${SETUP_HINT}` };
    console.error("Run save failed", error.code);
    return { ok: false, status: 500, code: "db", message: "Could not save the phone assignment." };
  }
  return { ok: true };
}
