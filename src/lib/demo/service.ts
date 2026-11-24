import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APPS, encodeSystemEvent, type App } from "@/lib/app/domain";
import type { PackModel } from "@/lib/starter-pack/generate";
import { normalizeTimezone } from "@/lib/timezone";
import {
  DAILY_CAP_MICRO, LOCK_MS, SEED, chooseAction, fillLine, nextGapMs, personaBySlug, planDate, seedTimes, turnKind, turnSender,
  type ChatState
} from "./engine";
import { writeLine, type Turn } from "./llm";
import { PERSONAS } from "./personas";
import { PHOTO_SUFFIXES, profileForUser } from "./profiles";

// Live demo mode (supabase/2026-11-24-live-demo.sql). Server only, service role. Only an INTERNAL account (profiles.internal) can be
// switched on: this file checks it, and a database trigger refuses it again. Every row written here has demo = true so reset removes
// exactly these rows. Nothing here sends email, touches a dating app or logs names or message text.

type Sb = SupabaseClient;
const BUCKET = "profile-photos";
export const DEMO_TZ_FALLBACK = "UTC";

type Session = { user_id: string; enabled: boolean; next_action_at: string; lock_until: string | null; timezone: string | null; spent_day: string; spent_micro: number; added_apps: string[]; last_tick_at: string | null; enabled_at: string | null };
type Profile = { internal: boolean; city: string | null; job: string | null; interests: string[] | null; voice: string | null; timezone: string | null };
export type DemoFailure = { ok: false; code: "not_internal" | "no_profile" | "migration" | "db"; message: string };
const iso = (ms: number) => new Date(ms).toISOString();
const utcDay = (ms: number) => iso(ms).slice(0, 10);
const isMissing = (e: { code?: string | null } | null | undefined) => ["42703", "42P01", "PGRST204", "PGRST205"].includes(e?.code ?? "");
const fail = (code: DemoFailure["code"], message: string): DemoFailure => ({ ok: false, code, message });

async function loadProfile(sb: Sb, userId: string): Promise<Profile | null> {
  const { data } = await sb.from("profiles").select("internal, city, job, interests, voice, timezone").eq("user_id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

// ---------- status (admin) ----------

export type DemoStatus = { available: boolean; migrated: boolean; enabled: boolean; matches: number; messages: number; dates: number; spentMicro: number; capMicro: number; lastTickAt: string | null };

export async function getDemoStatus(sb: Sb, userId: string, nowMs = Date.now()): Promise<DemoStatus> {
  const profile = await loadProfile(sb, userId);
  const base: DemoStatus = { available: Boolean(profile?.internal), migrated: true, enabled: false, matches: 0, messages: 0, dates: 0, spentMicro: 0, capMicro: DAILY_CAP_MICRO, lastTickAt: null };
  if (!profile?.internal) return base;
  const s = await sb.from("demo_sessions").select("*").eq("user_id", userId).maybeSingle();
  if (s.error) return { ...base, migrated: !isMissing(s.error) };
  const [m, msg, d] = await Promise.all([
    sb.from("matches").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("demo", true),
    sb.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("demo", true).neq("sender", "system_internal"),
    sb.from("dates").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("demo", true)
  ]);
  const row = s.data as Session | null;
  return { ...base, enabled: Boolean(row?.enabled), matches: m.count ?? 0, messages: msg.count ?? 0, dates: d.count ?? 0, spentMicro: row && row.spent_day === utcDay(nowMs) ? row.spent_micro : 0, lastTickAt: row?.last_tick_at ?? null };
}

/** For the app layout: is the signed-in user in demo mode? False for anyone who is not internal or when the table does not exist yet. */
export async function isDemoOn(sb: Sb, userId: string): Promise<boolean> {
  const { data, error } = await sb.from("demo_sessions").select("enabled").eq("user_id", userId).maybeSingle();
  return !error && data?.enabled === true;
}

// ---------- clean / enable / disable / reset ----------

/** Deletes everything demo mode wrote for this user (tagged rows, the old demo-* seeds, persona photos, apps it added). Returns the removed app list. */
async function clean(sb: Sb, userId: string): Promise<void> {
  const { data: s } = await sb.from("demo_sessions").select("added_apps").eq("user_id", userId).maybeSingle();
  await sb.from("account_activity").delete().eq("user_id", userId).or("demo.eq.true,idempotency_key.like.demo-*");
  await sb.from("dates").delete().eq("user_id", userId).or("demo.eq.true,external_id.like.demo-*");
  // Messages and takeovers go with their match (on delete cascade).
  await sb.from("matches").delete().eq("user_id", userId).or("demo.eq.true,external_id.like.demo-*");
  const added = ((s?.added_apps as string[] | undefined) ?? []).filter((a): a is App => (APPS as readonly string[]).includes(a));
  if (added.length) await sb.from("app_accounts").delete().eq("user_id", userId).in("app", added);
  const listed = await sb.storage.from(BUCKET).list(`${userId}/demo`, { limit: 100 });
  const names = (listed.data ?? []).map((f) => `${userId}/demo/${f.name}`);
  if (names.length) await sb.storage.from(BUCKET).remove(names);
  await sb.from("demo_sessions").update({ added_apps: [], updated_at: new Date().toISOString() }).eq("user_id", userId);
}

async function seed(sb: Sb, userId: string, profile: Profile, tz: string, nowMs: number, rng: () => number): Promise<DemoFailure | null> {
  // Apps: the demo spans all three. Ones the user had not chosen are added (and recorded, so reset can remove them).
  const { data: have } = await sb.from("app_accounts").select("app").eq("user_id", userId);
  const haveSet = new Set((have ?? []).map((a) => a.app as string));
  const added = APPS.filter((a) => !haveSet.has(a));
  if (added.length) {
    const { error } = await sb.from("app_accounts").insert(added.map((app) => ({ user_id: userId, app, status: "active" })));
    if (error) return fail("db", "Could not add the dating apps.");
  }
  // Persona photos: copied from the private demo/ masters into the user's own folder, so the signed-in user can read them (owner policy).
  await Promise.all(PERSONAS.flatMap((p) => PHOTO_SUFFIXES.map((x) => sb.storage.from(BUCKET).copy(`demo/${p.slug}${x}.jpg`, `${userId}/demo/${p.slug}${x}.jpg`))));

  const matchRows = SEED.map((spec) => {
    const p = personaBySlug(spec.slug)!;
    const t = seedTimes(spec, p.script.length, nowMs, rng);
    // Read state: a chat flagged unread was last opened right after his latest message, so her newer lines show as unread.
    const lastHim = t.lineAtMs.reduce((acc, at, i) => (turnSender(p, i) === "as_user_ai" ? at : acc), t.matchedAtMs);
    const lastAny = t.lineAtMs.length ? t.lineAtMs[t.lineAtMs.length - 1] : t.matchedAtMs;
    return { spec, p, t, row: { user_id: userId, app: p.app, name: p.name, age: p.age, photo_path: `${userId}/demo/${p.slug}.jpg`, profile: profileForUser(p, userId), last_read_at: iso(spec.unread ? lastHim + 1000 : lastAny + 5000), external_id: `demo-match-${p.slug}`, matched_at: iso(t.matchedAtMs), demo: true } };
  });
  const ins = await sb.from("matches").insert(matchRows.map((m) => m.row)).select("id, external_id");
  if (ins.error || !ins.data) return fail("db", "Could not add the demo matches.");
  const idBySlug = new Map(ins.data.map((r) => [String(r.external_id).replace("demo-match-", ""), r.id as string]));

  const messages: Record<string, unknown>[] = [];
  const activity: Record<string, unknown>[] = [];
  const dates: Record<string, unknown>[] = [];
  for (const { spec, p, t } of matchRows) {
    const matchId = idBySlug.get(p.slug)!;
    const plan = planDate(matchId, t.matchedAtMs, tz, profile.city);
    activity.push({ user_id: userId, app: p.app, kind: "match", count: 1, occurred_at: iso(t.matchedAtMs), idempotency_key: `demo-match-${p.slug}`, demo: true });
    t.lineAtMs.forEach((at, i) => {
      messages.push({ match_id: matchId, user_id: userId, sender: turnSender(p, i), body: fillLine(p.script[i], plan), sent_at: iso(at), external_id: `demo-msg-${matchId}-${i}`, delivered_at: iso(at), demo: true });
      activity.push({ user_id: userId, app: p.app, kind: "chat", count: 1, match_ref: matchId, occurred_at: iso(at), idempotency_key: `demo-chat-${matchId}-${i}`, demo: true });
    });
    if (spec.turns === "all") {
      const last = t.lineAtMs[t.lineAtMs.length - 1] + 30_000;
      dates.push({ user_id: userId, match_id: matchId, who: p.name, venue: plan.venue, address: plan.address, starts_at: plan.startsAt, summary: `You two talked about ${p.interest}.`, external_id: `demo-date-${matchId}`, demo: true });
      messages.push({ match_id: matchId, user_id: userId, sender: "system_internal", body: encodeSystemEvent({ kind: "date_booked", startsAt: plan.startsAt, venue: plan.venue }), sent_at: iso(last), delivered_at: iso(last), demo: true });
      activity.push({ user_id: userId, app: p.app, kind: "date_booked", count: 1, match_ref: matchId, occurred_at: iso(last), idempotency_key: `demo-date-${matchId}`, demo: true });
    }
  }
  // Swipes through the day (a batch every ~35 min over the last ~10 h, spread across the three apps).
  for (let i = 0; i < 16; i++) {
    const app = APPS[i % APPS.length];
    activity.push({ user_id: userId, app, kind: "swipes", count: 14 + Math.floor(rng() * 26), occurred_at: iso(nowMs - (i * 35 + 4 + Math.floor(rng() * 20)) * 60_000), idempotency_key: `demo-swipes-seed-${i}`, demo: true });
  }
  const [m, d, a] = await Promise.all([
    sb.from("messages").insert(messages), dates.length ? sb.from("dates").insert(dates) : Promise.resolve({ error: null }), sb.from("account_activity").insert(activity)
  ]);
  if (m.error || d.error || a.error) return fail("db", "Could not write the demo chats.");
  await sb.from("demo_sessions").update({ added_apps: added, updated_at: iso(nowMs) }).eq("user_id", userId);
  return null;
}

export async function enableDemo(sb: Sb, userId: string, opts: { timezone?: string | null; nowMs?: number; rng?: () => number } = {}): Promise<{ ok: true } | DemoFailure> {
  const nowMs = opts.nowMs ?? Date.now();
  const rng = opts.rng ?? Math.random;
  const profile = await loadProfile(sb, userId);
  if (!profile) return fail("no_profile", "No such account.");
  if (!profile.internal) return fail("not_internal", "Demo mode is only for internal accounts.");
  const probe = await sb.from("demo_sessions").select("user_id").limit(1);
  if (probe.error) return fail(isMissing(probe.error) ? "migration" : "db", isMissing(probe.error) ? "Run supabase/2026-11-24-live-demo.sql first." : "Could not read the demo state.");
  const tz = normalizeTimezone(opts.timezone) ?? normalizeTimezone(profile.timezone) ?? DEMO_TZ_FALLBACK;
  const up = await sb.from("demo_sessions").upsert({ user_id: userId, enabled: true, enabled_at: iso(nowMs), next_action_at: iso(nowMs + 12_000), lock_until: null, timezone: tz, updated_at: iso(nowMs) }, { onConflict: "user_id" });
  if (up.error) return fail(up.error.code === "23514" ? "not_internal" : "db", "Could not start demo mode.");
  await clean(sb, userId);
  const failed = await seed(sb, userId, profile, tz, nowMs, rng);
  if (failed) { await sb.from("demo_sessions").update({ enabled: false }).eq("user_id", userId); return failed; }
  return { ok: true };
}

/** Stops the simulation. The chats stay as they are (so a take can be finished); Reset removes them. */
export async function disableDemo(sb: Sb, userId: string): Promise<{ ok: true } | DemoFailure> {
  const { error } = await sb.from("demo_sessions").update({ enabled: false, lock_until: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return error ? fail(isMissing(error) ? "migration" : "db", "Could not turn demo mode off.") : { ok: true };
}

/** Wipes every demo row, photo and added app. If demo mode is on it starts over from the opening state. */
export async function resetDemo(sb: Sb, userId: string, opts: { timezone?: string | null } = {}): Promise<{ ok: true; reseeded: boolean } | DemoFailure> {
  const profile = await loadProfile(sb, userId);
  if (!profile) return fail("no_profile", "No such account.");
  const { data: s, error } = await sb.from("demo_sessions").select("enabled, timezone").eq("user_id", userId).maybeSingle();
  if (error) return fail(isMissing(error) ? "migration" : "db", isMissing(error) ? "Run supabase/2026-11-24-live-demo.sql first." : "Could not read the demo state.");
  if (s?.enabled && profile.internal) {
    const r = await enableDemo(sb, userId, { timezone: opts.timezone ?? (s.timezone as string | null) });
    return r.ok ? { ok: true, reseeded: true } : r;
  }
  await clean(sb, userId);
  return { ok: true, reseeded: false };
}

// ---------- the tick ----------

export type TickResult = { changed: boolean; action?: string };

/**
 * One step of the simulation, called by the open page. Does nothing unless demo mode is on for an internal account, the previous action was
 * long enough ago, and this call wins the lock (a second tab or a retry finds the row taken). One action per call: a message, a match, a
 * swipe batch or a booked date. Closing the page stops the ticks, so nothing is generated while nobody watches.
 */
export async function tickDemo(sb: Sb, userId: string, opts: { timezone?: string | null; model: PackModel | null; nowMs?: number; rng?: () => number }): Promise<TickResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const rng = opts.rng ?? Math.random;
  const claim = await sb.from("demo_sessions").update({ lock_until: iso(nowMs + LOCK_MS), last_tick_at: iso(nowMs) })
    .eq("user_id", userId).eq("enabled", true).lte("next_action_at", iso(nowMs)).or(`lock_until.is.null,lock_until.lt.${iso(nowMs)}`).select("*").maybeSingle();
  if (claim.error || !claim.data) return { changed: false };
  const session = claim.data as Session;
  const release = (patch: Record<string, unknown> = {}) => sb.from("demo_sessions").update({ lock_until: null, next_action_at: iso(nowMs + nextGapMs(rng)), ...patch }).eq("user_id", userId);
  try {
    const profile = await loadProfile(sb, userId);
    if (!profile?.internal) { await sb.from("demo_sessions").update({ enabled: false, lock_until: null }).eq("user_id", userId); return { changed: false }; }
    const tz = normalizeTimezone(opts.timezone) ?? normalizeTimezone(session.timezone) ?? normalizeTimezone(profile.timezone) ?? DEMO_TZ_FALLBACK;

    const [{ data: matches }, { data: msgs }, { data: dates }, { data: takeovers }, { data: accounts }] = await Promise.all([
      sb.from("matches").select("id, app, name, matched_at, external_id").eq("user_id", userId).eq("demo", true),
      sb.from("messages").select("match_id, sender, body, sent_at").eq("user_id", userId).eq("demo", true).neq("sender", "system_internal").order("sent_at"),
      sb.from("dates").select("match_id").eq("user_id", userId).eq("demo", true),
      sb.from("takeovers").select("match_id").eq("user_id", userId).is("ended_at", null),
      sb.from("app_accounts").select("app, user_paused").eq("user_id", userId)
    ]);
    const paused = new Set((accounts ?? []).filter((a) => a.user_paused).map((a) => a.app as string));
    const taken = new Set((takeovers ?? []).map((t) => t.match_id as string));
    const booked = new Set((dates ?? []).map((d) => d.match_id as string));
    const byMatch = new Map<string, { sender: string; body: string; sent_at: string }[]>();
    for (const m of msgs ?? []) { const list = byMatch.get(m.match_id as string) ?? []; list.push(m as never); byMatch.set(m.match_id as string, list); }
    const chats: (ChatState & { app: App; name: string; matchedAtMs: number })[] = (matches ?? []).map((m) => {
      const lines = byMatch.get(m.id as string) ?? [];
      const matchedAtMs = Date.parse(m.matched_at as string);
      return {
        matchId: m.id as string, slug: String(m.external_id).replace("demo-match-", ""), turns: lines.length, app: m.app as App, name: m.name as string, matchedAtMs,
        lastAtMs: lines.length ? Date.parse(lines[lines.length - 1].sent_at) : matchedAtMs, booked: booked.has(m.id as string),
        takenOver: taken.has(m.id as string) || paused.has(m.app as string)
      };
    });
    const action = chooseAction({ nowMs, chats, usedSlugs: new Set(chats.map((c) => c.slug)), lastMatchAtMs: Math.max(0, ...chats.map((c) => c.matchedAtMs)) }, rng);

    const today = utcDay(nowMs);
    let spent = session.spent_day === today ? session.spent_micro : 0;
    let changed = false;

    if (action.kind === "match") {
      const p = personaBySlug(action.slug)!;
      const { error } = await sb.from("matches").insert({ user_id: userId, app: p.app, name: p.name, age: p.age, photo_path: `${userId}/demo/${p.slug}.jpg`, profile: profileForUser(p, userId), last_read_at: iso(nowMs), external_id: `demo-match-${p.slug}`, matched_at: iso(nowMs), demo: true });
      if (!error) {
        await sb.from("account_activity").insert({ user_id: userId, app: p.app, kind: "match", count: 1, occurred_at: iso(nowMs), idempotency_key: `demo-match-${p.slug}`, demo: true });
        changed = true;
      }
    } else if (action.kind === "turn") {
      const chat = chats.find((c) => c.matchId === action.matchId)!;
      const p = personaBySlug(action.slug)!;
      const sender = turnSender(p, action.index);
      const kind = turnKind(p, action.index);
      const plan = planDate(chat.matchId, chat.matchedAtMs, tz, profile.city);
      const transcript: Turn[] = (byMatch.get(chat.matchId) ?? []).map((m) => ({ from: m.sender === "match" ? "her" : "him", text: m.body }));
      const model = spent < DAILY_CAP_MICRO ? opts.model : null;
      const line = await writeLine(model, {
        who: sender === "match" ? "her" : "him", persona: p, kind, plan, transcript, direction: p.script[action.index],
        user: { job: profile.job, city: profile.city, interests: profile.interests ?? [], voice: profile.voice ?? "warm" }
      });
      spent += line.costMicro;
      const { error } = await sb.from("messages").insert({ match_id: chat.matchId, user_id: userId, sender, body: line.text, sent_at: iso(nowMs), delivered_at: iso(nowMs), external_id: `demo-msg-${chat.matchId}-${action.index}`, demo: true });
      if (!error) {
        await sb.from("account_activity").insert({ user_id: userId, app: chat.app, kind: "chat", count: 1, match_ref: chat.matchId, occurred_at: iso(nowMs), idempotency_key: `demo-chat-${chat.matchId}-${action.index}`, demo: true });
        changed = true;
      }
    } else if (action.kind === "book") {
      const chat = chats.find((c) => c.matchId === action.matchId)!;
      const p = personaBySlug(action.slug)!;
      const plan = planDate(chat.matchId, chat.matchedAtMs, tz, profile.city);
      const { error } = await sb.from("dates").insert({ user_id: userId, match_id: chat.matchId, who: p.name, venue: plan.venue, address: plan.address, starts_at: plan.startsAt, summary: `You two talked about ${p.interest}.`, external_id: `demo-date-${chat.matchId}`, demo: true });
      if (!error) {
        await sb.from("messages").insert({ match_id: chat.matchId, user_id: userId, sender: "system_internal", body: encodeSystemEvent({ kind: "date_booked", startsAt: plan.startsAt, venue: plan.venue }), sent_at: iso(nowMs), delivered_at: iso(nowMs), demo: true });
        await sb.from("account_activity").insert({ user_id: userId, app: chat.app, kind: "date_booked", count: 1, match_ref: chat.matchId, occurred_at: iso(nowMs), idempotency_key: `demo-date-${chat.matchId}`, demo: true });
        changed = true;
      }
    } else if (action.kind === "swipes") {
      const apps = (accounts ?? []).map((a) => a.app as App).filter((a) => !paused.has(a));
      const app = apps[Math.floor(rng() * apps.length)];
      if (app) {
        const { error } = await sb.from("account_activity").insert({ user_id: userId, app, kind: "swipes", count: action.count, occurred_at: iso(nowMs), idempotency_key: `demo-swipes-${nowMs}-${Math.floor(rng() * 1e6)}`, demo: true });
        changed = !error;
      }
    }
    await release({ spent_day: today, spent_micro: spent, timezone: tz });
    return { changed, action: action.kind };
  } catch {
    await release();
    return { changed: false };
  }
}
