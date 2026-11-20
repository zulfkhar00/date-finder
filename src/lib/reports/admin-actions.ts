import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decideFlaggedPhoto, isUndefinedRelation } from "@/lib/starter-pack/photo-flags";
import { ACTION_LABELS, CLIENT_ACTIONS, allowedActions, parseNcmecId, parseNote, sameDeciderWarning, type ActionName, type Hold } from "./core";
import { getReport, logEvent, type ReportRow } from "./service";

// The admin's decisions on a report. Every action needs a note, is checked against the report's current state, and is written to
// reports_events with the admin's email and a timestamp. Account steps (pause, close, remove a photo) reuse the existing
// app_accounts pause and the photo_flags remove; nothing here talks to a dating app or sends a message.

type Admin = SupabaseClient;
export type ActionResult = { ok: true; message: string; warning?: string } | { ok: false; error: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string): ActionResult => ({ ok: false, error });

async function pauseAllApps(sb: Admin, userId: string): Promise<Record<string, string> | null> {
  const { data, error } = await sb.from("app_accounts").select("app, status").eq("user_id", userId);
  if (error) { console.error("Pause read failed", error.code); return null; }
  const snapshot: Record<string, string> = {};
  for (const a of data ?? []) snapshot[a.app as string] = a.status as string;
  for (const app of Object.keys(snapshot)) {
    const { error: e } = await sb.from("app_accounts").update({ status: "paused", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("app", app);
    if (e) { console.error("Pause failed", e.code); return null; }
  }
  return snapshot;
}

async function putHold(sb: Admin, report: ReportRow, hold: Hold, now: Date): Promise<{ ok: true; snapshot: Record<string, string> } | { ok: false; error: string }> {
  const userId = report.matched_user_id!;
  const { data: profile, error } = await sb.from("profiles").select("user_id, report_hold, report_hold_report_id").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: isUndefinedRelation(error) ? "Reports are not set up yet (run supabase/2026-11-20-reports.sql)." : "Couldn't read the client." };
  if (!profile) return { ok: false, error: "That client no longer exists." };
  // Restore state is the one from before the FIRST hold: a second report (or a re-pause) inherits it, never records "paused".
  const heldBy = profile.report_hold_report_id as string | null;
  const existing = heldBy ? (heldBy === report.id ? report : await getReport(sb, heldBy)) : null;
  const taken = await pauseAllApps(sb, userId);
  if (!taken) return { ok: false, error: "Couldn't pause the client's apps." };
  const snapshot = existing?.pause_snapshot ?? taken;
  const upd = await sb.from("profiles").update({ report_hold: hold, report_hold_report_id: report.id, report_hold_at: now.toISOString() }).eq("user_id", userId);
  if (upd.error) return { ok: false, error: "Couldn't put the hold on the account." };
  return { ok: true, snapshot };
}

/** Lifts the hold this report put on the account and restores each app to the status it had. Another report's hold is left alone. */
async function releaseHold(sb: Admin, report: ReportRow): Promise<boolean> {
  if (!report.matched_user_id) return true;
  const userId = report.matched_user_id;
  const { data: profile } = await sb.from("profiles").select("report_hold_report_id").eq("user_id", userId).maybeSingle();
  if (!profile || profile.report_hold_report_id !== report.id) return true;
  for (const [app, status] of Object.entries(report.pause_snapshot ?? {})) {
    if (!["setting_up", "live", "paused"].includes(status)) continue;
    await sb.from("app_accounts").update({ status, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("app", app);
  }
  const upd = await sb.from("profiles").update({ report_hold: null, report_hold_report_id: null, report_hold_at: null }).eq("user_id", userId);
  return !upd.error;
}

async function restoreRemovedPhotos(sb: Admin, reportId: string, userId: string): Promise<number> {
  const { data } = await sb.from("reports_events").select("detail").eq("report_id", reportId).eq("action", "removed_photo");
  let n = 0;
  for (const e of data ?? []) {
    const photoId = (e.detail as { photoId?: string } | null)?.photoId;
    if (!photoId || !uuid.test(photoId)) continue;
    const a = await sb.from("profile_photos").update({ deleted_at: null }).eq("id", photoId).eq("user_id", userId);
    await sb.from("photo_flags").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("photo_id", photoId).eq("user_id", userId);
    if (!a.error) n += 1;
  }
  return n;
}

async function removePhoto(sb: Admin, userId: string, photoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: photo } = await sb.from("profile_photos").select("id").eq("id", photoId).eq("user_id", userId).maybeSingle();
  if (!photo) return { ok: false, error: "That photo isn't one of this client's photos." };
  const { data: flag } = await sb.from("photo_flags").select("photo_id").eq("photo_id", photoId).maybeSingle();
  if (!flag) {
    const ins = await sb.from("photo_flags").insert({ photo_id: photoId, user_id: userId, flags: [], status: "flagged", flagged_at: new Date().toISOString() });
    if (ins.error) return { ok: false, error: isUndefinedRelation(ins.error) ? "Photo flags are not set up yet." : "Couldn't record the removal." };
  }
  return decideFlaggedPhoto(sb, userId, photoId, "remove");
}

export type ActionParams = { note: unknown; userId?: unknown; photoId?: unknown; ncmecId?: unknown };

export async function applyAction(sb: Admin, admin: string, reportId: string, action: ActionName, params: ActionParams, now: Date = new Date()): Promise<ActionResult> {
  if (!uuid.test(reportId)) return fail("Unknown report.");
  const note = parseNote(params.note);
  if (!note.ok) return fail("Write an internal note (at least 3 characters). It goes in the audit log.");
  const report = await getReport(sb, reportId);
  if (!report) return fail("Unknown report.");
  if (!allowedActions({ status: report.status, category: report.category, matched: !!report.matched_user_id }).includes(action)) {
    return fail(`"${ACTION_LABELS[action]}" isn't available for a ${report.status} report${CLIENT_ACTIONS.includes(action) && !report.matched_user_id ? " without a linked client" : ""}. Reload the page.`);
  }
  const iso = now.toISOString();
  const base: Record<string, unknown> = { updated_at: iso };
  const detail: Record<string, unknown> = {};
  let message = "Done.";
  let warning: string | undefined;
  const ack = () => { if (!report.ack_at) { base.ack_at = iso; base.ack_by = admin; } };
  const decide = (status: "actioned" | "dismissed") => { base.status = status; base.resolved_at = report.resolved_at ?? iso; base.decided_by = admin; };
  let logAs: string = action;

  switch (action) {
    case "acknowledge": base.status = "acknowledged"; ack(); message = "Acknowledged."; break;
    case "investigate": base.status = "investigating"; ack(); message = "Marked as investigating."; break;
    case "mark_actioned": ack(); decide("actioned"); message = "Marked actioned."; break;
    case "dismiss": {
      ack(); decide("dismissed");
      if (report.matched_user_id && !(await releaseHold(sb, report))) return fail("Couldn't lift the hold this report put on the account.");
      message = "Dismissed."; break;
    }
    case "link_client": {
      const id = String(params.userId ?? "");
      if (!uuid.test(id)) return fail("Choose a client to link.");
      const { data: p } = await sb.from("profiles").select("user_id").eq("user_id", id).maybeSingle();
      if (!p) return fail("That client doesn't exist.");
      base.matched_user_id = id; detail.userId = id; message = "Client linked."; break;
    }
    case "unlink_client": {
      if (report.matched_user_id && !(await releaseHold(sb, report))) return fail("Lift the hold first: couldn't release it.");
      base.matched_user_id = null; detail.userId = report.matched_user_id; message = "Client unlinked."; break;
    }
    case "pause_client": {
      const held = await putHold(sb, report, "paused", now);
      if (!held.ok) return fail(held.error);
      base.pause_snapshot = held.snapshot; ack(); base.decided_by = report.decided_by ?? admin;
      if (report.status === "new" || report.status === "acknowledged") base.status = "investigating";
      detail.userId = report.matched_user_id; message = "Client paused. Nothing runs on their account; they see an appeal notice."; break;
    }
    case "close_account": {
      const held = await putHold(sb, report, "closed", now);
      if (!held.ok) return fail(held.error);
      base.pause_snapshot = held.snapshot; ack(); decide("actioned");
      detail.userId = report.matched_user_id; message = "Account closed (soft). They can sign in only to see the notice and appeal."; break;
    }
    case "remove_photo": {
      const photoId = String(params.photoId ?? "");
      if (!uuid.test(photoId)) return fail("Choose the photo to remove.");
      const r = await removePhoto(sb, report.matched_user_id!, photoId);
      if (!r.ok) return fail(r.error);
      ack(); decide("actioned"); detail.photoId = photoId; logAs = "removed_photo"; message = "Photo removed."; break;
    }
    case "record_ncmec": {
      const id = parseNcmecId(params.ncmecId);
      if (!id.ok) return fail("Enter the CyberTipline report ID you were given (letters, digits, dashes).");
      base.ncmec_filed_at = iso; base.ncmec_report_id = id.id; base.ncmec_filed_by = admin; detail.ncmecReportId = id.id; logAs = "ncmec_recorded";
      message = "NCMEC filing recorded."; break;
    }
    case "appeal_uphold": case "appeal_overturn": {
      const overturn = action === "appeal_overturn";
      const same = sameDeciderWarning(report.decided_by, admin);
      detail.sameAdminAsOriginalDecision = same;
      if (same) warning = "You made the original decision. A different admin should normally decide an appeal. It was saved and the audit log notes it.";
      if (overturn) {
        if (!(await releaseHold(sb, report))) return fail("Couldn't lift the hold.");
        if (report.matched_user_id) detail.photosRestored = await restoreRemovedPhotos(sb, report.id, report.matched_user_id);
      }
      base.status = overturn ? "dismissed" : "actioned"; base.appeal_outcome = overturn ? "overturned" : "upheld";
      base.appeal_decided_by = admin; base.appeal_decided_at = iso; base.resolved_at = iso;
      logAs = overturn ? "appeal_overturned" : "appeal_upheld";
      message = overturn ? "Appeal granted: the account is restored." : "Appeal rejected: the decision stands."; break;
    }
  }

  // The status guard makes a double click, or two admins at once, apply once.
  const { data, error } = await sb.from("reports").update(base).eq("id", report.id).eq("status", report.status).select("id");
  if (error || !data?.length) {
    if (error) console.error("Report update failed", error.code);
    return fail(error ? "Couldn't save. Try again." : "Someone else changed this report. Reload the page.");
  }
  await logEvent(sb, report.id, admin, logAs, note.note, { ...detail, from: report.status, to: (base.status as string | undefined) ?? report.status });
  return { ok: true, message, warning };
}
