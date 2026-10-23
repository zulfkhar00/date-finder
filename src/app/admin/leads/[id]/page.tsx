import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { updateLeadNotes } from "../../_lib/actions";
import { AdminDataError, DEFAULT_VARIANT_LABEL, NO_CAMPAIGN_LABEL, getLead, type LeadDetail } from "../../_lib/data";
import { EVENT_LABELS, STAGE_LABELS, STATUS_LABELS, formatDateTime } from "../../_lib/format";
import { datingAppLabels, datingPreferenceLabels, dateFrequencyLabels, relationshipGoalLabels } from "@/lib/reservation";
import { Badge, QueryErrorNotice, SchemaNotice, SetupNotice } from "../../_components/notices";
import { NotesForm } from "./notes-form";
import styles from "../../admin.module.css";

function text(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return "—";
}

function appsText(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value.map((app) => datingAppLabels[app as keyof typeof datingAppLabels] ?? String(app)).join(", ");
}

function OnboardingCard({ lead }: { lead: LeadDetail }) {
  const data = lead.onboarding.data;
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h2>Onboarding answers</h2></div>
      {!lead.onboarding.available ? (
        <p className={styles.error} style={{ marginTop: 0 }}>Onboarding answers need supabase/2026-10-23-onboarding.sql applied.</p>
      ) : !data ? (
        <p className={styles.muted} style={{ marginTop: 0 }}>Not stored for this reservation (signed up before onboarding existed).</p>
      ) : (
        <dl className={styles.dl}>
          <dt>First name</dt><dd>{text(data.name)}</dd>
          <dt>Age</dt><dd>{text(data.age)}</dd>
          <dt>Apps</dt><dd>{appsText(data.apps)}</dd>
          <dt>Her age range</dt><dd>{typeof data.ageMin === "number" && typeof data.ageMax === "number" ? `${data.ageMin}–${data.ageMax}` : "—"}</dd>
          <dt>His type</dt><dd>{text(data.interests)}</dd>
        </dl>
      )}
    </section>
  );
}

type TimelineItem = { at: string | null; title: string; meta?: string; strong?: boolean };

function buildTimeline(lead: LeadDetail): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const event of lead.events) {
    // The reservation row and paid_at cover these two; skip duplicates from the funnel.
    if (event.event === "paid") continue;
    const parts = [event.variant ? `variant ${event.variant}` : null, event.utm_campaign ? `campaign ${event.utm_campaign}` : null].filter(Boolean);
    items.push({ at: event.created_at, title: EVENT_LABELS[event.event] ?? event.event, meta: parts.join(" · ") || undefined });
  }
  items.push({ at: lead.created_at, title: "Reservation created", meta: "Form submitted, status pending", strong: true });
  if (lead.paid_at) items.push({ at: lead.paid_at, title: `Paid — queue #${lead.queue_position ?? "?"}`, strong: true });
  if (lead.refund_requested_at) items.push({ at: lead.refund_requested_at, title: "Refund requested" });
  if (lead.notes.updated_at) {
    items.push({ at: lead.notes.updated_at, title: `Stage set to ${STAGE_LABELS[lead.notes.stage] ?? lead.notes.stage}`, meta: lead.notes.updated_by ? `by ${lead.notes.updated_by}` : undefined });
  }
  items.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  if (lead.status === "expired" || lead.status === "refunded") {
    items.push({ at: null, title: `Now ${STATUS_LABELS[lead.status].toLowerCase()}`, meta: lead.status === "expired" ? "Checkout expired without payment" : "Refunded in Stripe; waitlist place removed", strong: true });
  }
  return items;
}

export default async function AdminLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const { id } = await params;
  let lead: LeadDetail | null = null;
  let problem: "schema" | "query" | null = null;
  try {
    lead = await getLead(id);
  } catch (error) {
    problem = error instanceof AdminDataError && error.schemaMissing ? "schema" : "query";
  }
  if (!lead && !problem) notFound();

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.sub}><Link href="/admin/leads" className={styles.rowLink}>← Leads</Link></p>
          <h1 style={{ marginTop: 6 }}>{lead?.email ?? "Lead"}</h1>
        </div>
        {lead ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Badge value={lead.status} label={STATUS_LABELS[lead.status]} />
            <Badge value={lead.notes.stage} label={STAGE_LABELS[lead.notes.stage]} />
          </div>
        ) : null}
      </div>

      {problem === "schema" ? <SchemaNotice /> : null}
      {problem === "query" ? <QueryErrorNotice /> : null}

      {lead ? (
        <div className={styles.detailGrid}>
          <div style={{ display: "grid", gap: 20 }}>
            <section className={styles.card}>
              <div className={styles.cardHead}><h2>Reservation</h2></div>
              <dl className={styles.dl}>
                <dt>Email</dt><dd>{lead.email}</dd>
                <dt>City</dt><dd>{lead.city}</dd>
                <dt>Dating</dt><dd>{datingPreferenceLabels[lead.dating_preference as keyof typeof datingPreferenceLabels] ?? lead.dating_preference}</dd>
                <dt>Looking for</dt><dd>{relationshipGoalLabels[lead.relationship_goal as keyof typeof relationshipGoalLabels] ?? lead.relationship_goal}</dd>
                <dt>Date frequency</dt><dd>{dateFrequencyLabels[lead.date_frequency as keyof typeof dateFrequencyLabels] ?? lead.date_frequency}</dd>
                <dt>Status</dt><dd>{STATUS_LABELS[lead.status]}</dd>
                <dt>Queue position</dt><dd>{lead.queue_position ?? "—"}</dd>
                <dt>Created</dt><dd>{formatDateTime(lead.created_at)}</dd>
                <dt>Paid at</dt><dd>{formatDateTime(lead.paid_at)}</dd>
                <dt>Age confirmed</dt><dd>{formatDateTime(lead.age_confirmed_at)}</dd>
                <dt>Terms accepted</dt><dd>{formatDateTime(lead.terms_accepted_at)}</dd>
              </dl>
            </section>
            <OnboardingCard lead={lead} />
            <section className={styles.card}>
              <div className={styles.cardHead}><h2>Attribution (first touch)</h2></div>
              <dl className={styles.dl}>
                <dt>Variant</dt><dd>{lead.variant ?? DEFAULT_VARIANT_LABEL}</dd>
                <dt>utm_source</dt><dd>{lead.utm_source ?? "—"}</dd>
                <dt>utm_medium</dt><dd>{lead.utm_medium ?? "—"}</dd>
                <dt>utm_campaign</dt><dd>{lead.utm_campaign ?? NO_CAMPAIGN_LABEL}</dd>
                <dt>utm_content</dt><dd>{lead.utm_content ?? "—"}</dd>
                <dt>utm_term</dt><dd>{lead.utm_term ?? "—"}</dd>
                <dt>Referrer</dt><dd>{lead.referrer ?? "—"}</dd>
              </dl>
            </section>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Stage &amp; notes</h2>
                {lead.notes.updated_at ? (
                  <span className={styles.muted} style={{ fontSize: 12 }}>
                    Updated {formatDateTime(lead.notes.updated_at)}{lead.notes.updated_by ? ` by ${lead.notes.updated_by}` : ""}
                  </span>
                ) : null}
              </div>
              {lead.notes.available ? null : (
                <p className={styles.error} style={{ marginTop: 0 }}>Notes need supabase/2026-10-23-admin.sql applied.</p>
              )}
              <NotesForm
                action={updateLeadNotes.bind(null, lead.id)}
                stage={lead.notes.stage}
                notes={lead.notes.notes}
                disabled={!lead.notes.available}
              />
            </section>
            <section className={styles.card}>
              <div className={styles.cardHead}><h2>Timeline</h2></div>
              {!lead.has_checkout ? <p className={styles.muted} style={{ marginTop: 0 }}>No Stripe Checkout was created for this reservation.</p> : null}
              <ol className={styles.timeline}>
                {buildTimeline(lead).map((item, index) => (
                  <li key={`${item.at ?? "now"}-${index}`} className={styles.timelineItem}>
                    <span className={`${styles.timelineDot} ${item.strong ? styles.timelineDotStrong : ""}`} aria-hidden />
                    <div className={styles.timelineTitle}>{item.title}</div>
                    <div className={styles.timelineMeta}>
                      {item.at ? formatDateTime(item.at) : "Current status"}
                      {item.meta ? ` · ${item.meta}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
