import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSiteUrl } from "@/lib/admin-config";
import { notifyOps } from "@/lib/ops-notify";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isUndefinedRelation } from "@/lib/starter-pack/photo-flags";
import {
  LIMITS, emailsIn, appealState, checkUpload, decideRate, groupKey, newReference, opsLineBreach, opsLineNew, slaFor, cleanText,
  type AppealState, type Category, type Hold, type ReportInput, type Status
} from "./core";

// Server half of the takedown process (supabase/2026-11-20-reports.sql). Service role only; a browser can read none of it.
// Nothing here logs report text, emails, file names or addresses: errors are reduced to a Postgres code.

type Admin = SupabaseClient;

export type ReportRow = {
  id: string; ref: string; status: Status; category: Category; urgent: boolean; in_danger: boolean; subject_kind: string; dating_app: string | null;
  profile_ref: string | null; group_key: string | null; description: string; reporter_email: string | null; attachment_path: string | null;
  matched_user_id: string | null; created_at: string; updated_at: string; ack_at: string | null; ack_by: string | null; resolved_at: string | null;
  decided_by: string | null; pause_snapshot: Record<string, string> | null; ncmec_filed_at: string | null; ncmec_report_id: string | null; ncmec_filed_by: string | null;
  appeal_text: string | null; appealed_at: string | null; appeal_outcome: string | null; appeal_decided_by: string | null; appeal_decided_at: string | null;
  ack_breach_alerted_at: string | null; resolve_breach_alerted_at: string | null;
};
export type EventRow = { id: string; at: string; actor: string; action: string; note: string | null; detail: Record<string, unknown> | null };

export const REPORT_COLUMNS = "id, ref, status, category, urgent, in_danger, subject_kind, dating_app, profile_ref, group_key, description, reporter_email, attachment_path, matched_user_id, created_at, updated_at, ack_at, ack_by, resolved_at, decided_by, pause_snapshot, ncmec_filed_at, ncmec_report_id, ncmec_filed_by, appeal_text, appealed_at, appeal_outcome, appeal_decided_by, appeal_decided_at, ack_breach_alerted_at, resolve_breach_alerted_at";

export function reportLink(id: string): string {
  const origin = parseSiteUrl(process.env.SITE_URL) ?? "";
  return `${origin}/admin/reports/${id}`;
}

/** Keyed hash of the address, for rate limiting only. The address itself is never stored or logged. */
export function hashIp(ip: string): string {
  const key = process.env.REPORT_HASH_SALT || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "noswipe-reports";
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32);
}

export async function logEvent(sb: Admin, reportId: string, actor: string, action: string, note: string | null, detail?: Record<string, unknown>): Promise<boolean> {
  const { error } = await sb.from("reports_events").insert({ report_id: reportId, actor, action, note, detail: detail ?? null });
  if (error) console.error("Report event failed", error.code);
  return !error;
}

// ---------- public submission ----------

export type SubmitResult = { ok: true; ref: string } | { ok: false; code: "rate" | "busy" | "upload" | "unavailable" | "error"; error: string };

async function count(sb: Admin, since: string, ipHash?: string | null): Promise<{ n: number; error: { code?: string | null } | null }> {
  let q = sb.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (ipHash) q = q.eq("ip_hash", ipHash);
  const { count: n, error } = await q;
  return { n: n ?? 0, error };
}

/**
 * Stores one report. Order: rate limit, upload check, upload, insert (retrying a reference collision), audit event, ops line.
 * A failed insert removes the uploaded file again.
 */
export async function submitReport(input: ReportInput, file: Uint8Array | null, ipHash: string | null, now: Date = new Date(), sb: Admin = getSupabaseAdmin()): Promise<SubmitResult> {
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const [ipHour, ipDay, all] = await Promise.all([
    ipHash ? count(sb, hourAgo, ipHash) : { n: 0, error: null }, ipHash ? count(sb, dayAgo, ipHash) : { n: 0, error: null }, count(sb, hourAgo)
  ]);
  const readError = ipHour.error ?? ipDay.error ?? all.error;
  if (readError) {
    if (!isUndefinedRelation(readError)) console.error("Report rate read failed", readError.code);
    return { ok: false, code: "unavailable", error: "The form is temporarily unavailable. Please email support@noswipe.app and we will handle it the same way." };
  }
  const rate = decideRate({ ipLastHour: ipHour.n, ipLastDay: ipDay.n, allLastHour: all.n });
  if (!rate.ok) {
    return rate.reason === "ip"
      ? { ok: false, code: "rate", error: "You have sent several reports recently. We have them and are reviewing them. If this is new and urgent, email support@noswipe.app." }
      : { ok: false, code: "busy", error: "We are receiving a lot of reports right now. Please email support@noswipe.app so nothing is missed." };
  }

  let upload: { type: string; ext: string } | null = null;
  if (file) {
    const checked = checkUpload(file);
    if (!checked.ok) return { ok: false, code: "upload", error: checked.error };
    upload = checked;
  }

  const key = groupKey(input.datingApp, input.profileRef);
  let related = 0;
  if (key) {
    const r = await sb.from("reports").select("id", { count: "exact", head: true }).eq("group_key", key);
    related = r.count ?? 0;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = newReference();
    let path: string | null = null;
    if (file && upload) {
      path = `${ref}/${randomUUID()}.${upload.ext}`;
      const up = await sb.storage.from("report-uploads").upload(path, file, { contentType: upload.type, upsert: false });
      if (up.error) {
        console.error("Report upload failed", (up.error as { statusCode?: string }).statusCode ?? "unknown");
        return { ok: false, code: "upload", error: "We couldn't store the screenshot. Try again, or send the report without it." };
      }
    }
    const urgent = input.inDanger || ["minor_safety", "trafficking", "non_consensual_images", "threats"].includes(input.category);
    const { data, error } = await sb.from("reports").insert({
      ref, status: "new", category: input.category, urgent, in_danger: input.inDanger, subject_kind: input.subjectKind, dating_app: input.datingApp,
      profile_ref: input.profileRef, group_key: key, description: input.description, reporter_email: input.email, attachment_path: path, ip_hash: ipHash,
      created_at: now.toISOString(), updated_at: now.toISOString()
    }).select("id").single();
    if (error || !data) {
      if (path) await sb.storage.from("report-uploads").remove([path]);
      if (error?.code === "23505") continue; // reference collision: draw another
      console.error("Report insert failed", error?.code ?? "unknown");
      if (isUndefinedRelation(error)) return { ok: false, code: "unavailable", error: "The form is temporarily unavailable. Please email support@noswipe.app and we will handle it the same way." };
      return { ok: false, code: "error", error: "Something went wrong and your report was not saved. Please try again, or email support@noswipe.app." };
    }
    await logEvent(sb, data.id as string, "reporter", "created", null, { anonymous: !input.email, attachment: !!path, related });
    if (rate.opsLine === "line") notifyOps("reports", opsLineNew({ ref, category: input.category, urgent, datingApp: input.datingApp, related }, reportLink(data.id as string)), `report:${ref}`);
    else if (rate.opsLine === "summary") notifyOps("reports", `High volume of reports: more than 10 in the last hour. Further reports are not announced one by one, check the queue.\n${parseSiteUrl(process.env.SITE_URL) ?? ""}/admin/reports`, `reports-flood:${hourAgo.slice(0, 13)}`);
    return { ok: true, ref };
  }
  return { ok: false, code: "error", error: "Something went wrong and your report was not saved. Please try again, or email support@noswipe.app." };
}

// ---------- admin reads ----------

export async function listReports(sb: Admin): Promise<{ rows: ReportRow[]; groupCounts: Map<string, number>; setupNeeded: boolean }> {
  const { data, error } = await sb.from("reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (error) {
    if (!isUndefinedRelation(error)) console.error("Reports read failed", error.code);
    return { rows: [], groupCounts: new Map(), setupNeeded: isUndefinedRelation(error) };
  }
  const rows = (data ?? []) as unknown as ReportRow[];
  const groupCounts = new Map<string, number>();
  for (const r of rows) if (r.group_key) groupCounts.set(r.group_key, (groupCounts.get(r.group_key) ?? 0) + 1);
  return { rows, groupCounts, setupNeeded: false };
}

export async function getReport(sb: Admin, id: string): Promise<ReportRow | null> {
  const { data, error } = await sb.from("reports").select(REPORT_COLUMNS).eq("id", id).maybeSingle();
  if (error) { console.error("Report read failed", error.code); return null; }
  return (data as unknown as ReportRow | null) ?? null;
}
export async function getEvents(sb: Admin, id: string): Promise<EventRow[]> {
  const { data, error } = await sb.from("reports_events").select("id, at, actor, action, note, detail").eq("report_id", id).order("at", { ascending: true }).limit(200);
  if (error) { console.error("Report events read failed", error.code); return []; }
  return (data ?? []) as unknown as EventRow[];
}
export async function getRelated(sb: Admin, report: ReportRow): Promise<ReportRow[]> {
  if (!report.group_key) return [];
  const { data } = await sb.from("reports").select(REPORT_COLUMNS).eq("group_key", report.group_key).order("created_at", { ascending: false }).limit(50);
  return ((data ?? []) as unknown as ReportRow[]).filter((r) => r.id !== report.id);
}

export type Candidate = { userId: string; name: string | null; email: string | null; reason: string };

async function emailOf(sb: Admin, userId: string): Promise<string | null> {
  const { data } = await sb.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** Possible clients for a report, by an email in the text or by first name + the app. Suggestions only: a person confirms the link. */
export async function findCandidates(sb: Admin, report: ReportRow, emailLookup: (email: string) => Promise<string | null>): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  const text = `${report.profile_ref ?? ""}\n${report.description}`;
  for (const email of emailsIn(text)) {
    const id = await emailLookup(email);
    if (id) out.set(id, { userId: id, name: null, email, reason: "email in the report" });
  }
  const ref = report.profile_ref?.trim() ?? "";
  if (ref && !/[/.:]/.test(ref)) {
    const token = ref.replace(/^@/, "").split(/\s+/)[0].toLowerCase();
    const { data: profiles } = await sb.from("profiles").select("user_id, first_name").limit(2000);
    const named = (profiles ?? []).filter((p) => (p.first_name as string | null)?.trim().toLowerCase() === token).map((p) => p.user_id as string).slice(0, 20);
    if (named.length) {
      const { data: apps } = await sb.from("app_accounts").select("user_id, app").in("user_id", named);
      for (const id of named) {
        const onApp = report.dating_app && (apps ?? []).some((a) => a.user_id === id && a.app === report.dating_app);
        if (!out.has(id)) out.set(id, { userId: id, name: token, email: null, reason: onApp ? `first name and ${report.dating_app}` : "first name only" });
      }
    }
  }
  if (report.matched_user_id && !out.has(report.matched_user_id)) out.set(report.matched_user_id, { userId: report.matched_user_id, name: null, email: null, reason: "linked" });
  const list = [...out.values()].slice(0, 6);
  await Promise.all(list.map(async (c) => {
    const { data } = await sb.from("profiles").select("first_name").eq("user_id", c.userId).maybeSingle();
    c.name = (data?.first_name as string | null) ?? c.name;
    c.email ??= await emailOf(sb, c.userId);
  }));
  return list;
}

/** Looks an auth user up by email (bounded paging; the client list is small). */
export async function userIdByEmail(sb: Admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.trim().toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

// ---------- SLA sweep ----------

export type SweepResult = { checked: number; alerted: number };

/**
 * Posts one ops line per SLA breach, once. The alert is claimed with a conditional update, so two sweeps (cron, an admin page
 * view, another instance) never announce the same breach twice. Appeals reuse the resolve column (it is reset when appealed).
 */
export async function runSlaSweep(sb: Admin = getSupabaseAdmin(), now: Date = new Date()): Promise<SweepResult> {
  const { data, error } = await sb.from("reports").select(REPORT_COLUMNS).in("status", ["new", "acknowledged", "investigating", "appealed"]).limit(500);
  if (error) { if (!isUndefinedRelation(error)) console.error("Report sweep read failed", error.code); return { checked: 0, alerted: 0 }; }
  let alerted = 0;
  const rows = (data ?? []) as unknown as ReportRow[];
  for (const r of rows) {
    const sla = slaFor(r, now);
    if (!sla.overdue || !sla.kind) continue;
    const column = sla.kind === "acknowledge" ? "ack_breach_alerted_at" : "resolve_breach_alerted_at";
    if (r[column]) continue;
    const claim = await sb.from("reports").update({ [column]: now.toISOString() }).eq("id", r.id).is(column, null).select("id");
    if (claim.error || !claim.data?.length) continue;
    alerted += 1;
    notifyOps("reports", opsLineBreach(r, sla, reportLink(r.id)), `sla:${r.id}:${sla.kind}`);
  }
  return { checked: rows.length, alerted };
}

// ---------- the held user's view ----------

export type HoldNotice = { hold: Hold; ref: string; since: string; appeal: AppealState };

/** The signed-in user's hold, if a report put one on their account. Tolerates the migration not being applied. */
export async function getHoldNotice(userId: string, now: Date = new Date(), sb: Admin = getSupabaseAdmin()): Promise<HoldNotice | null> {
  const { data: profile, error } = await sb.from("profiles").select("report_hold, report_hold_report_id, report_hold_at").eq("user_id", userId).maybeSingle();
  if (error) { if (!isUndefinedRelation(error)) console.error("Hold read failed", error.code); return null; }
  const hold = profile?.report_hold as Hold | null | undefined;
  const reportId = profile?.report_hold_report_id as string | null | undefined;
  if (!hold || !reportId) return null;
  const report = await getReport(sb, reportId);
  if (!report) return null;
  const since = (profile?.report_hold_at as string | null) ?? report.updated_at;
  return { hold, ref: report.ref, since, appeal: appealState(report, since, now) };
}

export type AppealResult = { ok: true; ref: string } | { ok: false; error: string };

/** The held user's one appeal: within 14 days of the decision, only while the hold is on their own account. */
export async function submitAppeal(userId: string, text: unknown, now: Date = new Date(), sb: Admin = getSupabaseAdmin()): Promise<AppealResult> {
  const body = cleanText(text, LIMITS.appeal + 1);
  if (body.length < LIMITS.appealMin) return { ok: false, error: "Tell us why you think this was a mistake (a few words at least)." };
  if (body.length > LIMITS.appeal) return { ok: false, error: `Keep it under ${LIMITS.appeal} characters.` };
  const notice = await getHoldNotice(userId, now, sb);
  if (!notice) return { ok: false, error: "There is nothing to appeal on this account." };
  if (notice.appeal.kind === "submitted") return { ok: false, error: "We already have your appeal and will answer by email within 7 days." };
  if (notice.appeal.kind === "decided") return { ok: false, error: "Your appeal was already reviewed. Email support@noswipe.app if you have new information." };
  if (notice.appeal.kind === "expired") return { ok: false, error: "The 14-day appeal window has ended. Email support@noswipe.app and we will look at it." };
  const { data: report } = await sb.from("reports").select("id, status").eq("ref", notice.ref).maybeSingle();
  if (!report || (report.status as Status) === "appealed") return { ok: false, error: "We already have your appeal." };
  const { data, error } = await sb.from("reports").update({
    status: "appealed", appeal_text: body, appealed_at: now.toISOString(), updated_at: now.toISOString(), resolve_breach_alerted_at: null
  }).eq("id", report.id).eq("matched_user_id", userId).neq("status", "appealed").select("id");
  if (error || !data?.length) { if (error) console.error("Appeal failed", error.code); return { ok: false, error: "We couldn't save your appeal. Try again in a moment." }; }
  await logEvent(sb, report.id as string, "user", "appealed", null, { previous_status: report.status as string });
  notifyOps("reports", `Appeal received for ${notice.ref}, review within 7 days\n${reportLink(report.id as string)}`, `appeal:${report.id}:${now.getTime()}`);
  return { ok: true, ref: notice.ref };
}
