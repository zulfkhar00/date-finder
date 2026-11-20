import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { livePhotoRows } from "@/lib/starter-pack/photo-flags";
import { findCandidates, getEvents, getRelated, getReport, userIdByEmail } from "@/lib/reports/service";
import {
  ACTION_LABELS, APPEAL_SLA_MS, CATEGORY_LABELS, DATING_APP_LABELS, STATUS_LABELS, SUBJECT_LABELS, allowedActions, formatAge, formatRemaining, sameDeciderWarning, slaFor,
  type ActionName, type DatingApp, type SubjectKind
} from "@/lib/reports/core";
import { OpForm } from "../../clients/op-form";
import { LocalTime } from "../../_components/local-time";
import { SetupNotice } from "../../_components/notices";
import { reportAction } from "../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const NCMEC_STEPS = [
  "Do not copy, forward or download the material. Do not open it more than you must.",
  "File a CyberTipline report yourself at report.cybertip.org: describe what was reported, where, and when. Attach nothing you were not able to review lawfully.",
  "Write down the report ID you are given and record it below with a note.",
  "Pause or close the client's account here if the reported profile is one of our clients, and keep the report open for law enforcement follow-up (preservation requests go through support@noswipe.app)."
];

function ActionBox({ id, action, children, extra, hint }: { id: string; action: ActionName; children?: ReactNode; extra?: ReactNode; hint?: string }) {
  return (
    <div className={styles.actionBox} data-testid={`action-${action}`}>
      <OpForm action={reportAction.bind(null, id, action)} label={ACTION_LABELS[action]} pendingLabel="Saving…">
        <strong>{ACTION_LABELS[action]}</strong>
        {hint ? <span className={styles.muted}>{hint}</span> : null}
        {extra}
        <label className={styles.field}>Internal note (required, goes in the audit log)
          <textarea className={styles.textarea} style={{ minHeight: 64 }} name="note" required minLength={3} maxLength={2000} rows={2} />
        </label>
        {children}
      </OpForm>
    </div>
  );
}

export default async function AdminReportPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = getSupabaseAdmin();
  const report = await getReport(sb, id);
  if (!report) notFound();
  const now = new Date();
  const [events, related, candidates] = await Promise.all([
    getEvents(sb, id), getRelated(sb, report), findCandidates(sb, report, (email) => userIdByEmail(sb, email))
  ]);
  const sla = slaFor(report, now);
  const allowed = new Set(allowedActions({ status: report.status, category: report.category, matched: !!report.matched_user_id }));
  const linked = report.matched_user_id ? candidates.find((c) => c.userId === report.matched_user_id) ?? null : null;
  const photos = report.matched_user_id ? await livePhotoRows<{ id: string; path: string }>(sb, report.matched_user_id, "id, path", 12) : [];
  const signed = photos.length ? (await sb.storage.from("profile-photos").createSignedUrls(photos.map((p) => p.path), 600)).data ?? [] : [];
  const photoUrl = new Map<string, string>(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as [string, string]] : [])));
  const attachmentUrl = report.attachment_path ? (await sb.storage.from("report-uploads").createSignedUrl(report.attachment_path, 300)).data?.signedUrl ?? null : null;
  const same = report.status === "appealed" && sameDeciderWarning(report.decided_by, access.email);

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.sub}><Link href="/admin/reports" className={styles.rowLink}>← Reports</Link></p>
          <h1>{report.ref}</h1>
          <p className={styles.sub}>
            {report.urgent ? <span className={styles.badge} data-tone="warn">Urgent</span> : null} <span className={styles.badge}>{STATUS_LABELS[report.status]}</span> {CATEGORY_LABELS[report.category]} · received <LocalTime iso={report.created_at} /> ({formatAge(now.getTime() - new Date(report.created_at).getTime())} ago)
          </p>
          {sla.kind && sla.remainingMs !== null ? (
            <p className={sla.overdue ? styles.slaOver : styles.slaOk} style={{ marginTop: 6 }} data-testid="sla-line">
              {sla.kind === "acknowledge" ? `Acknowledge by ` : sla.kind === "appeal" ? "Review the appeal by " : "Resolve by "}<LocalTime iso={sla.dueAt?.toISOString()} /> · {formatRemaining(sla.remainingMs)}
            </p>
          ) : null}
        </div>
      </div>

      {same ? <div className={styles.notice} role="alert" data-testid="same-admin-warning"><strong>You made the original decision on this report.</strong> A different admin should normally decide an appeal. You can still do it; the audit log will note that you did.</div> : null}

      <div className={styles.detailGrid}>
        <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
          <section className={styles.card}>
            <h2 className={styles.subhead}>The report</h2>
            <dl className={styles.dl}>
              <dt>About</dt><dd>{SUBJECT_LABELS[report.subject_kind as SubjectKind] ?? report.subject_kind}</dd>
              <dt>Dating app</dt><dd>{report.dating_app ? DATING_APP_LABELS[report.dating_app as DatingApp] ?? report.dating_app : "—"}</dd>
              <dt>Profile name or link</dt><dd>{report.profile_ref ?? "—"}</dd>
              <dt>Reporter</dt><dd>{report.reporter_email ? <a href={`mailto:${report.reporter_email}`}>{report.reporter_email}</a> : "Anonymous"}</dd>
              <dt>In danger</dt><dd>{report.in_danger ? <strong>Yes, the reporter said someone is in danger</strong> : "No"}</dd>
              <dt>Image</dt><dd>{attachmentUrl ? <>
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>Open image (link expires in 5 minutes)</a>
                {report.category === "minor_safety" ? <span className={styles.muted}> May show a minor. Do not download or forward it; see the NCMEC steps.</span> : null}
              </> : report.attachment_path ? "Stored, link unavailable" : "None"}</dd>
            </dl>
            <p style={{ whiteSpace: "pre-wrap", margin: "14px 0 0", overflowWrap: "anywhere" }} data-testid="report-description">{report.description}</p>
          </section>

          {related.length ? (
            <section className={styles.card} data-testid="related-reports">
              <h2 className={styles.subhead}>Same profile: {related.length} other report{related.length > 1 ? "s" : ""}</h2>
              <p className={styles.sub}>Reports about the same app and profile are grouped. Several independent reports raise the weight of each.</p>
              <ul className={styles.plainList}>
                {related.map((r) => <li key={r.id}><Link href={`/admin/reports/${r.id}`} className={styles.rowLink}>{r.ref}</Link> {CATEGORY_LABELS[r.category]} · <span className={styles.badge}>{STATUS_LABELS[r.status]}</span> · <LocalTime iso={r.created_at} /></li>)}
              </ul>
            </section>
          ) : null}

          {report.appeal_text ? (
            <section className={styles.card} data-testid="appeal-panel">
              <h2 className={styles.subhead}>Appeal {report.appeal_outcome ? <span className={styles.badge}>{report.appeal_outcome}</span> : null}</h2>
              <p className={styles.sub}>Received <LocalTime iso={report.appealed_at} />{report.status === "appealed" && report.appealed_at ? <> · review by <LocalTime iso={new Date(new Date(report.appealed_at).getTime() + APPEAL_SLA_MS).toISOString()} /> (7 days)</> : null}. Original decision by {report.decided_by ?? "unknown"}.</p>
              <p style={{ whiteSpace: "pre-wrap", margin: 0, overflowWrap: "anywhere" }}>{report.appeal_text}</p>
            </section>
          ) : null}

          <section className={styles.card}>
            <h2 className={styles.subhead}>Audit log</h2>
            <ol className={styles.timeline}>
              {events.map((e) => (
                <li key={e.id} className={styles.timelineItem}>
                  <span className={`${styles.timelineDot} ${e.actor !== "reporter" && e.actor !== "system" ? styles.timelineDotStrong : ""}`} />
                  <div className={styles.timelineTitle}>{e.action.replace(/_/g, " ")}</div>
                  <div className={styles.timelineMeta}>{e.actor} · <LocalTime iso={e.at} /></div>
                  {e.note ? <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{e.note}</div> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
          <section className={styles.card} data-testid="client-panel">
            <h2 className={styles.subhead}>Client</h2>
            {report.matched_user_id ? (
              <p style={{ margin: "0 0 10px" }}>Linked: <Link href={`/admin/clients/${report.matched_user_id}`} className={styles.rowLink}>{linked?.name ?? "client"}{linked?.email ? ` (${linked.email})` : ""}</Link></p>
            ) : candidates.length ? (
              <p className={styles.sub}>Possible matches. Check before you link: a name alone can be a different person.</p>
            ) : <p className={styles.sub}>No client matched by email or by name and app. This may be about someone who is not our client: acknowledge it, then mark it actioned or dismiss it. We cannot act on another service&rsquo;s accounts.</p>}
            {!report.matched_user_id && allowed.has("link_client") ? candidates.map((c) => (
              <div key={c.userId} className={styles.actionBox}>
                <OpForm action={reportAction.bind(null, report.id, "link_client")} label="Link to this client" pendingLabel="Linking…">
                  <input type="hidden" name="userId" value={c.userId} />
                  <strong>{c.name ?? "Client"}{c.email ? ` · ${c.email}` : ""}</strong>
                  <span className={styles.muted}>Matched by {c.reason}</span>
                  <label className={styles.field}>Internal note (required)<textarea className={styles.textarea} style={{ minHeight: 56 }} name="note" required minLength={3} maxLength={2000} rows={2} /></label>
                </OpForm>
              </div>
            )) : null}
          </section>

          {report.category === "minor_safety" ? (
            <section className={styles.card} data-testid="ncmec-panel">
              <h2 className={styles.subhead}>Report to NCMEC</h2>
              <p className={styles.sub}>US law requires us to report apparent child sexual exploitation. This is a person&rsquo;s job: nothing is submitted automatically.</p>
              <ol style={{ paddingLeft: 20, margin: "0 0 12px", display: "grid", gap: 6 }}>{NCMEC_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
              <p style={{ margin: "0 0 12px" }}><a className={styles.button} href="https://report.cybertip.org/" target="_blank" rel="noopener noreferrer">Open the CyberTipline</a></p>
              {report.ncmec_report_id ? <p className={styles.success} data-testid="ncmec-recorded">Filed <LocalTime iso={report.ncmec_filed_at} /> by {report.ncmec_filed_by}. CyberTipline ID <strong>{report.ncmec_report_id}</strong>.</p> : <p className={styles.muted} style={{ margin: "0 0 8px" }}>Not filed yet.</p>}
              {allowed.has("record_ncmec") ? (
                <ActionBox id={report.id} action="record_ncmec" hint={report.ncmec_report_id ? "Record a further filing (replaces the stored ID; the log keeps both)." : undefined}
                  extra={<label className={styles.field}>CyberTipline report ID<input className={styles.input} name="ncmecId" required maxLength={60} autoComplete="off" /></label>} />
              ) : null}
            </section>
          ) : null}

          <section className={styles.card} data-testid="actions-panel">
            <h2 className={styles.subhead}>Actions</h2>
            <p className={styles.sub}>Every action needs a note and is logged with your email and the time.</p>
            <div style={{ display: "grid", gap: 14 }}>
              {allowed.has("acknowledge") ? <ActionBox id={report.id} action="acknowledge" /> : null}
              {allowed.has("investigate") ? <ActionBox id={report.id} action="investigate" /> : null}
              {allowed.has("pause_client") ? <ActionBox id={report.id} action="pause_client" hint="Sets every app to paused. They see a notice with an appeal button." /> : null}
              {allowed.has("remove_photo") ? (
                <ActionBox id={report.id} action="remove_photo" hint="Soft-deletes the photo (the file stays until a person purges it).">
                  {photos.length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="Photo to remove">
                      {photos.map((p) => (
                        <label key={p.id} style={{ display: "grid", gap: 4, justifyItems: "center" }}>
                          {photoUrl.get(p.path) ? <img src={photoUrl.get(p.path)} alt="Client photo" style={{ height: 84, borderRadius: 8 }} /> : <span className={styles.muted}>unavailable</span>}
                          <input type="radio" name="photoId" value={p.id} required />
                        </label>
                      ))}
                    </div>
                  ) : <span className={styles.muted}>This client has no photos.</span>}
                </ActionBox>
              ) : null}
              {allowed.has("close_account") ? <ActionBox id={report.id} action="close_account" hint="Soft close: nothing runs and the app shows only the notice. Their data is kept. An appeal can reverse it." /> : null}
              {allowed.has("mark_actioned") ? <ActionBox id={report.id} action="mark_actioned" hint="For outcomes outside an account step, such as a report to the authorities or the other platform." /> : null}
              {allowed.has("dismiss") ? <ActionBox id={report.id} action="dismiss" hint="Also lifts a pause this report put on the client." /> : null}
              {allowed.has("appeal_uphold") ? <ActionBox id={report.id} action="appeal_uphold" /> : null}
              {allowed.has("appeal_overturn") ? <ActionBox id={report.id} action="appeal_overturn" hint="Lifts the hold, restores the apps and any removed photos." /> : null}
              {allowed.has("unlink_client") && report.matched_user_id ? <ActionBox id={report.id} action="unlink_client" hint="Lifts any hold this report placed." /> : null}
              {!allowed.size || (allowed.size === 1 && allowed.has("link_client")) ? <p className={styles.muted}>No further actions for this report.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
