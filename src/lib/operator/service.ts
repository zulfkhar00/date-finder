import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APPS, effectiveStatus, type App, type AppStatus } from "@/lib/app/domain";
import { isStripeTestSession } from "@/lib/internal-traffic";
import { addNoteEvent, changeAppStatus } from "@/lib/fulfilment/service";
import { flaggedPhotoIds, isUndefinedRelation, livePhotoRows } from "@/lib/starter-pack/photo-flags";
import { PACK_VERSION, packContentSchema, type PackContent } from "@/lib/starter-pack/types";
import { CHECKLIST_STEPS, canTick, decideTransition, isStep, progress, resolveReason, type ChecklistStep, type StepTick } from "./checklist";
import { normalizeTimezone } from "@/lib/timezone";
import { KIT_SECTIONS, buildKit, buildSection, isKitSection, type KitInput, type KitSection, type KitSections } from "./kit";
import { zipStore } from "./zip";

// Server half of the operator tools (supabase/2026-11-22-operator-kit.sql). Service role only. Nothing here logs names, emails, bios,
// photo paths or photo bytes: errors are reduced to a Postgres code.

type Admin = SupabaseClient;
export type Failure = { ok: false; status: number; code: string; message: string };
const SETUP_HINT = "Run supabase/2026-11-22-operator-kit.sql first.";
const fail = (status: number, code: string, message: string): Failure => ({ ok: false, status, code, message });
const isApp = (v: string): v is App => (APPS as readonly string[]).includes(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- who is a paying client ----------

/** A real (non-test) paid reservation exists for the client's email. Internal accounts count as ready so the flow can be tested end to end. */
export async function kitAllowed(sb: Admin, userId: string): Promise<{ allowed: boolean; paid: boolean; internal: boolean; email?: string }> {
  const [{ data: profile }, auth] = await Promise.all([sb.from("profiles").select("internal").eq("user_id", userId).maybeSingle(), sb.auth.admin.getUserById(userId)]);
  const internal = !!profile?.internal;
  const email = auth.data.user?.email?.toLowerCase();
  let paid = false;
  if (email) {
    const { data } = await sb.from("reservations").select("status, stripe_checkout_session_id").eq("email", email).eq("status", "paid");
    paid = (data ?? []).some((r) => !isStripeTestSession(r.stripe_checkout_session_id as string | null));
  }
  return { allowed: paid || internal, paid, internal, email };
}

// ---------- kit ----------

export type KitRow = { app: App; sections: Partial<KitSections>; timezone: string | null; generatedAt: string; updatedAt: string; updatedBy: string };

async function loadKitInput(sb: Admin, userId: string, app: App): Promise<KitInput | null> {
  const [{ data: profile }, { data: prefs }, { data: pack }, photos, flagged] = await Promise.all([
    sb.from("profiles").select("first_name, gender, interested_in, voice, city").eq("user_id", userId).maybeSingle(),
    sb.from("preferences").select("age_min, age_max, distance_km, looking_for, dealbreakers").eq("user_id", userId).maybeSingle(),
    sb.from("starter_packs").select("status, content").eq("user_id", userId).eq("version", PACK_VERSION).maybeSingle(),
    livePhotoRows<{ id: string; position: number }>(sb, userId, "id, position"),
    flaggedPhotoIds(userId, sb)
  ]);
  if (!profile) return null;
  const parsed = pack?.content ? packContentSchema.safeParse(pack.content) : null;
  const content: PackContent | null = parsed?.success ? parsed.data : null;
  return { app, profile: profile as KitInput["profile"], prefs: (prefs as KitInput["prefs"]) ?? null, pack: content, photos: photos.map((p) => ({ id: p.id, position: p.position, flagged: flagged.has(p.id) })) };
}

export async function listKits(sb: Admin, userId: string): Promise<{ kits: Partial<Record<App, KitRow>>; setupNeeded: boolean }> {
  const { data, error } = await sb.from("account_kits").select("app, sections, timezone, generated_at, updated_at, updated_by").eq("user_id", userId);
  if (error) { if (!isUndefinedRelation(error)) console.error("Kit read failed", error.code); return { kits: {}, setupNeeded: isUndefinedRelation(error) }; }
  const kits: Partial<Record<App, KitRow>> = {};
  for (const r of data ?? []) if (isApp(r.app as string)) kits[r.app as App] = { app: r.app as App, sections: (r.sections ?? {}) as Partial<KitSections>, timezone: (r.timezone as string | null) ?? null, generatedAt: r.generated_at as string, updatedAt: r.updated_at as string, updatedBy: r.updated_by as string };
  return { kits, setupNeeded: false };
}

/** What the kit had to leave out because the client has not given it yet. Said in the kit's note so an operator knows to rebuild. */
export function kitGaps(input: KitInput): string[] {
  const gaps: string[] = [];
  if (!input.pack) gaps.push("starter pack");
  if (!input.photos.length) gaps.push("photos");
  if (!input.prefs) gaps.push("preferences");
  if (!input.profile.first_name) gaps.push("first name");
  return gaps;
}

/**
 * Builds the whole kit for one app from the client's current data. Only for paid clients (or internal test accounts).
 * `onlyIfMissing` (the automatic path) inserts instead of replacing: a kit that exists is never touched, so an operator's edits survive,
 * and two racing callers cannot both write (the unique key refuses the second, which then logs nothing).
 */
export async function generateKit(sb: Admin, actor: string, userId: string, app: string, opts: { onlyIfMissing?: boolean } = {}): Promise<{ ok: true; created: boolean } | Failure> {
  if (!UUID.test(userId) || !isApp(app)) return fail(400, "invalid", "Unknown client or app.");
  const gate = await kitAllowed(sb, userId);
  if (!gate.allowed) return fail(409, "not_paid", "The kit is made after the client has paid.");
  const { data: account } = await sb.from("app_accounts").select("app").eq("user_id", userId).eq("app", app).maybeSingle();
  if (!account) return fail(409, "no_app", "The client did not choose this app.");
  const input = await loadKitInput(sb, userId, app);
  if (!input) return fail(404, "not_found", "Unknown client.");
  const existing = await listKits(sb, userId);
  if (opts.onlyIfMissing && existing.kits[app]) return { ok: true, created: false };
  const now = new Date().toISOString();
  const row = {
    user_id: userId, app, sections: buildKit(input), timezone: Object.values(existing.kits).find((k) => k?.timezone)?.timezone ?? null, generated_at: now, updated_at: now, updated_by: actor.slice(0, 254)
  };
  const { error } = opts.onlyIfMissing ? await sb.from("account_kits").insert(row) : await sb.from("account_kits").upsert(row, { onConflict: "user_id,app" });
  if (error) {
    if (opts.onlyIfMissing && error.code === "23505") return { ok: true, created: false };
    if (isUndefinedRelation(error)) return fail(503, "migration", `The kit is not set up. ${SETUP_HINT}`);
    console.error("Kit save failed", error.code); return fail(500, "db", "Could not save the kit.");
  }
  const gaps = opts.onlyIfMissing ? kitGaps(input) : [];
  await addNoteEvent(sb, actor, userId, opts.onlyIfMissing ? `Kit generated automatically${gaps.length ? ` without: ${gaps.join(", ")}. Rebuild it once they are in` : ""}.` : "Kit generated.", app);
  return { ok: true, created: true };
}

/** Rebuilds one section from current data and leaves the others as they are. */
export async function regenerateSection(sb: Admin, actor: string, userId: string, app: string, section: string): Promise<{ ok: true } | Failure> {
  if (!UUID.test(userId) || !isApp(app) || !isKitSection(section)) return fail(400, "invalid", "Unknown section.");
  const { kits, setupNeeded } = await listKits(sb, userId);
  if (setupNeeded) return fail(503, "migration", `The kit is not set up. ${SETUP_HINT}`);
  const row = kits[app];
  if (!row) return fail(409, "no_kit", "Generate the kit first.");
  const input = await loadKitInput(sb, userId, app);
  if (!input) return fail(404, "not_found", "Unknown client.");
  const { error } = await sb.from("account_kits").update({ sections: { ...row.sections, [section]: buildSection(section, input) }, updated_at: new Date().toISOString(), updated_by: actor.slice(0, 254) }).eq("user_id", userId).eq("app", app);
  if (error) { console.error("Kit section save failed", error.code); return fail(500, "db", "Could not save the section."); }
  await addNoteEvent(sb, actor, userId, `Kit section rebuilt: ${section}.`, app);
  return { ok: true };
}

/** Sets the client's IANA zone: profiles.timezone is the source of truth (the rig reads it); the kit rows are kept in step for the schedule windows. */
export async function setKitTimezone(sb: Admin, actor: string, userId: string, timezone: string): Promise<{ ok: true } | Failure> {
  const raw = timezone.trim();
  if (!UUID.test(userId)) return fail(400, "invalid", "Unknown client.");
  const tz = raw ? normalizeTimezone(raw) : null;
  if (raw && !tz) return fail(400, "invalid", "Use a zone name like America/Los_Angeles or Europe/London.");
  const { data, error } = await sb.from("profiles").update({ timezone: tz, updated_at: new Date().toISOString() }).eq("user_id", userId).select("user_id");
  if (error) { console.error("Time zone save failed", error.code); return fail(500, "db", "Could not save the time zone. Has supabase/2026-11-22-client-timezone.sql been applied?"); }
  if (!data?.length) return fail(404, "not_found", "Unknown client.");
  const kits = await sb.from("account_kits").update({ timezone: tz, updated_at: new Date().toISOString(), updated_by: actor.slice(0, 254) }).eq("user_id", userId);
  if (kits.error && !isUndefinedRelation(kits.error)) { console.error("Kit time zone save failed", kits.error.code); return fail(500, "db", "Saved on the client, but not on the kit."); }
  return { ok: true };
}

/** The photos of the kit in order, as {id, path}. Flagged and removed photos are never included (the kit already left them out). */
export async function kitPhotoFiles(sb: Admin, userId: string, app: string): Promise<{ ok: true; files: { id: string; path: string; role: string }[] } | Failure> {
  if (!UUID.test(userId) || !isApp(app)) return fail(400, "invalid", "Unknown client or app.");
  const { kits } = await listKits(sb, userId);
  const items = kits[app]?.sections.photos?.items;
  if (!items?.length) return fail(404, "no_kit", "Generate the kit first.");
  const rows = await livePhotoRows<{ id: string; path: string }>(sb, userId, "id, path");
  const byId = new Map(rows.map((r) => [r.id, r.path]));
  const flagged = await flaggedPhotoIds(userId, sb);
  const files = items.flatMap((i) => (byId.has(i.photoId) && !flagged.has(i.photoId) ? [{ id: i.photoId, path: byId.get(i.photoId)!, role: i.role }] : []));
  return files.length ? { ok: true, files } : fail(404, "no_photos", "None of the kit photos are available.");
}

/** Downloads the kit photos from the private bucket into one zip, in memory. Nothing is kept and nothing is logged. */
export async function buildPhotoZip(sb: Admin, userId: string, app: string): Promise<{ ok: true; zip: Uint8Array; count: number } | Failure> {
  const listed = await kitPhotoFiles(sb, userId, app);
  if (!listed.ok) return listed;
  const out: { name: string; data: Uint8Array }[] = [];
  for (const [i, f] of listed.files.entries()) {
    const { data, error } = await sb.storage.from("profile-photos").download(f.path);
    if (error || !data) continue;
    const ext = /\.(jpe?g|png|webp)$/i.exec(f.path)?.[1]?.toLowerCase() ?? "jpg";
    out.push({ name: `${String(i + 1).padStart(2, "0")}-${f.role}.${ext}`, data: new Uint8Array(await data.arrayBuffer()) });
  }
  if (!out.length) return fail(502, "storage", "Could not read the photos.");
  return { ok: true, zip: zipStore(out), count: out.length };
}

// ---------- checklist ----------

export async function listTicks(sb: Admin, userId: string): Promise<{ ticks: Record<string, StepTick[]>; setupNeeded: boolean }> {
  const { data, error } = await sb.from("account_checklist").select("app, step, done_by, done_at").eq("user_id", userId);
  if (error) { if (!isUndefinedRelation(error)) console.error("Checklist read failed", error.code); return { ticks: {}, setupNeeded: isUndefinedRelation(error) }; }
  const ticks: Record<string, StepTick[]> = {};
  for (const r of data ?? []) if (isStep(r.step)) (ticks[r.app as string] ??= []).push({ step: r.step, doneBy: r.done_by as string, doneAt: r.done_at as string });
  return { ticks, setupNeeded: false };
}

async function phoneAssigned(sb: Admin, userId: string, app: App): Promise<boolean> {
  const { data } = await sb.from("account_runs").select("phone_id").eq("user_id", userId).eq("app", app).maybeSingle();
  return !!data?.phone_id;
}

/** If every step is ticked and the app is still setting up, make it active. Returns whether it moved. */
async function applyTransition(sb: Admin, userId: string, app: App): Promise<boolean> {
  const [{ data: account }, { ticks }] = await Promise.all([sb.from("app_accounts").select("status, user_paused").eq("user_id", userId).eq("app", app).maybeSingle(), listTicks(sb, userId)]);
  if (!account) return false;
  const decision = decideTransition(account as { status: AppStatus; user_paused: boolean }, ticks[app] ?? []);
  if (decision.to !== "active") return false;
  const result = await changeAppStatus(sb, "checklist", userId, app, { status: "active", note: "Creation checklist complete." });
  return result.ok;
}

export async function tickStep(sb: Admin, actor: string, userId: string, app: string, step: string, done: boolean): Promise<{ ok: true; activated: boolean } | Failure> {
  if (!UUID.test(userId) || !isApp(app) || !isStep(step)) return fail(400, "invalid", "Unknown app or step.");
  if (done) {
    const can = canTick(step, { phoneAssigned: await phoneAssigned(sb, userId, app) });
    if (!can.ok) return fail(409, "precondition", can.message);
  }
  const { error } = done
    ? await sb.from("account_checklist").upsert({ user_id: userId, app, step, done_by: actor.slice(0, 254), done_at: new Date().toISOString() }, { onConflict: "user_id,app,step" })
    : await sb.from("account_checklist").delete().eq("user_id", userId).eq("app", app).eq("step", step);
  if (error) { if (isUndefinedRelation(error)) return fail(503, "migration", `The checklist is not set up. ${SETUP_HINT}`); console.error("Checklist save failed", error.code); return fail(500, "db", "Could not save the step."); }
  await addNoteEvent(sb, actor, userId, `Checklist: ${step.replace(/_/g, " ")} ${done ? "done" : "undone"}.`, app);
  return { ok: true, activated: done ? await applyTransition(sb, userId, app) : false };
}

/** The Run panel saved a phone (or cleared it): the "assign a phone" step follows it, so the two can never disagree. */
export async function syncPhoneStep(sb: Admin, actor: string, userId: string, app: string, hasPhone: boolean): Promise<void> {
  if (!isApp(app)) return;
  await tickStep(sb, actor, userId, app, "assign_phone", hasPhone).catch(() => undefined);
}

/** A fresh cycle (the client came back after a close, or the team starts over): clears the ticks and sets the app back to setting up. */
export async function restartSetup(sb: Admin, actor: string, userId: string, app: string): Promise<{ ok: true } | Failure> {
  if (!UUID.test(userId) || !isApp(app)) return fail(400, "invalid", "Unknown client or app.");
  const { error } = await sb.from("account_checklist").delete().eq("user_id", userId).eq("app", app);
  if (error && !isUndefinedRelation(error)) return fail(500, "db", "Could not reset the checklist.");
  const result = await changeAppStatus(sb, actor, userId, app, { status: "setting_up", note: "Setup restarted." });
  if (!result.ok) return result;
  // The phone is still assigned from last time, so that step is true again.
  if (await phoneAssigned(sb, userId, app)) await tickStep(sb, actor, userId, app, "assign_phone", true);
  return { ok: true };
}

/** "Needs you": a template (or own words) becomes the reason on the client's Home, and the app waits for them. */
export async function requestClientAction(sb: Admin, actor: string, userId: string, app: string, templateId: string, custom: string): Promise<{ ok: true } | Failure> {
  if (!UUID.test(userId) || !isApp(app)) return fail(400, "invalid", "Unknown client or app.");
  const reason = resolveReason(templateId, custom);
  if (!reason.ok) return fail(400, "invalid", reason.error);
  const { data: account } = await sb.from("app_accounts").select("status, user_paused").eq("user_id", userId).eq("app", app).maybeSingle();
  if (!account) return fail(409, "no_app", "The client did not choose this app.");
  const status = effectiveStatus(account as { status: AppStatus; user_paused: boolean });
  if (status === "closed") return fail(409, "closed", "This app is closed. Restart setup first.");
  const result = await changeAppStatus(sb, actor, userId, app, { status: "needs_client_action", reason: reason.reason });
  return result.ok ? { ok: true } : result;
}

/** The client did what we asked: back to setting up (and straight to active if the checklist is already complete). */
export async function clientActionDone(sb: Admin, actor: string, userId: string, app: string): Promise<{ ok: true; activated: boolean } | Failure> {
  if (!UUID.test(userId) || !isApp(app)) return fail(400, "invalid", "Unknown client or app.");
  const result = await changeAppStatus(sb, actor, userId, app, { status: "setting_up", note: "Client action done." });
  if (!result.ok) return result;
  return { ok: true, activated: await applyTransition(sb, userId, app) };
}

/**
 * Activates every app whose checklist is complete but which is still setting up (a client who paused mid-setup and resumed, or a
 * tick that raced). Called by the fulfilment sweep. Returns the count only.
 */
export async function reconcileChecklists(sb: Admin): Promise<number> {
  const { data, error } = await sb.from("app_accounts").select("user_id, app, status, user_paused").in("status", ["setting_up", "awaiting_login"]).eq("user_paused", false).limit(500);
  if (error || !data?.length) return 0;
  const ids = [...new Set(data.map((a) => a.user_id as string))];
  const { data: rows, error: tickError } = await sb.from("account_checklist").select("user_id, app, step").in("user_id", ids);
  if (tickError) return 0;
  const have = new Map<string, StepTick[]>();
  for (const r of rows ?? []) if (isStep(r.step)) { const k = `${r.user_id}:${r.app}`; (have.get(k) ?? have.set(k, []).get(k)!).push({ step: r.step, doneBy: "", doneAt: "" }); }
  let moved = 0;
  for (const a of data) {
    if (!isApp(a.app as string)) continue;
    const ticks = have.get(`${a.user_id}:${a.app}`) ?? [];
    if (!progress(ticks).complete) continue;
    if (await applyTransition(sb, a.user_id as string, a.app as App)) moved += 1;
  }
  return moved;
}

export { CHECKLIST_STEPS, KIT_SECTIONS };
export type { ChecklistStep, KitSection };
