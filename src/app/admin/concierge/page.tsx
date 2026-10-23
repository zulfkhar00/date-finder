import { requireAdminPage } from "@/lib/admin-auth";
import { finalMessage } from "@/lib/concierge/format";
import { loadQueue, type DraftRow } from "@/lib/concierge/operator";
import { safeErrorText } from "@/lib/concierge/telegram";
import { KIND_LABELS, type DraftOutput } from "@/lib/concierge/types";
import { SetupNotice } from "../_components/notices";
import { ConciergeHeader, ConfigNotices } from "./header";
import { DraftDecision } from "./ui";
import styles from "./concierge.module.css";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function Details({ output }: { output: DraftOutput }) {
  switch (output.kind) {
    case "profile":
      return <div className={styles.grid}>
        {output.photo_ranking.length > 0 && <div className={styles.block}><h4>Photo ranking</h4><ol>{output.photo_ranking.map((photo, index) => <li key={index}>Photo {photo.photo}: <strong>{photo.verdict}</strong> ({photo.reason})</li>)}</ol></div>}
        {output.per_app.map((app) => <div key={app.app} className={styles.block}><h4>{app.app}</h4><p className={styles.pre}>{app.bio}</p>{app.prompts.map((prompt, index) => <p key={index}><strong>{prompt.prompt}</strong><br />{prompt.answer}</p>)}</div>)}
        {output.settings_to_change.length > 0 && <div className={styles.block}><h4>Settings</h4><ul>{output.settings_to_change.map((setting, index) => <li key={index}>{setting}</li>)}</ul></div>}
      </div>;
    case "opener":
      return <div className={styles.block}><h4>Openers</h4><ol>{output.openers.map((opener, index) => <li key={index}>{opener.text} <span className={styles.meta}>(references: {opener.references})</span></li>)}</ol></div>;
    case "reply":
      return <div className={styles.block}>
        <h4>Read <span className={`${styles.badge} ${output.warmth === "warm" ? styles.badgeWarm : ""}`}>{output.warmth}</span>{output.ask_out_now && <span className={`${styles.badge} ${styles.badgeWarm}`}>Ask her out now</span>}</h4>
        <p>{output.read}</p>
        {output.respect_note && <p><strong>Respect her pace:</strong> {output.respect_note}</p>}
      </div>;
    case "date_plan":
      return <div className={styles.block}><h4>Places</h4><ol>{output.places.map((place, index) => <li key={index}><strong>{place.name}</strong>, {place.area}: {place.why}</li>)}</ol><p>When: {output.time}</p></div>;
  }
}

function DraftCard({ draft, mode }: { draft: DraftRow; mode: "pending" | "undelivered" | "sending" | "failed" | "recent" }) {
  const output = draft.output as DraftOutput;
  const hasOutput = typeof output?.message === "string";
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{draft.clients?.name ?? "Unknown client"} · {KIND_LABELS[draft.kind]}<span className={styles.badge}>{draft.status.replaceAll("_", " ")}</span></span>
        <span className={styles.meta}>Received {when(draft.created_at)}{draft.decided_at ? ` · decided ${when(draft.decided_at)}${draft.decided_by ? ` by ${draft.decided_by}` : ""}` : ""}</span>
      </div>
      {draft.input_summary && <p className={styles.summary}><strong>Input:</strong> {draft.input_summary}</p>}
      {draft.operator_note && <p className={styles.meta}>Note: {draft.operator_note}</p>}
      {hasOutput && <Details output={output} />}
      {hasOutput && output.operator_flags?.length > 0 && <div className={styles.flags}><h4>Check before approving</h4><ul>{output.operator_flags.map((flag, index) => <li key={index}>{flag}</li>)}</ul></div>}
      {mode === "recent" && hasOutput && <details className={`${styles.details} ${styles.block}`}><summary>Message</summary><p className={styles.pre}>{finalMessage(output)}</p></details>}
      {mode === "sending" && <p className={styles.meta}>Sending since {when(draft.send_started_at)}. If it is still here after a couple of minutes, the send was interrupted: check his chat, then release it.</p>}
      {(mode === "pending" || mode === "undelivered") && hasOutput && <DraftDecision id={draft.id} message={finalMessage(output)} mode={mode} />}
      {mode === "sending" && <DraftDecision id={draft.id} message="" mode="sending" />}
      {mode === "failed" && <DraftDecision id={draft.id} message="" mode="failed" />}
    </article>
  );
}

function Section({ title, rows, mode, empty }: { title: string; rows: DraftRow[]; mode: Parameters<typeof DraftCard>[0]["mode"]; empty?: string }) {
  if (!rows.length && !empty) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title} <span className={styles.count}>{rows.length}</span></h2>
      {rows.length ? rows.map((draft) => <DraftCard key={draft.id} draft={draft} mode={mode} />) : <p className={styles.empty}>{empty}</p>}
    </section>
  );
}

export default async function ConciergeQueue() {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  let queue: Awaited<ReturnType<typeof loadQueue>> | null = null;
  try {
    queue = await loadQueue();
  } catch (error) {
    console.error("Concierge queue load failed", safeErrorText(error));
  }
  return (
    <main className={styles.page}>
      <ConciergeHeader active="queue" />
      <ConfigNotices />
      <p className={styles.meta}>Every draft needs your approval before it reaches the client. He sends every message himself. Screenshots are never stored; only the summary below is kept, with contact details removed, and drafts are deleted after 30 days.</p>
      {!queue && <p className={styles.notice}>Couldn&apos;t load drafts. Has <code>supabase/2026-10-23-concierge.sql</code> been applied? The server log has the error code.</p>}
      {queue && <>
        <Section title="Waiting for review" rows={queue.pending} mode="pending" empty="Nothing waiting. New drafts appear here when a client sends a screenshot." />
        <Section title="Sending" rows={queue.sending} mode="sending" />
        <Section title="Approved, not delivered" rows={queue.undelivered} mode="undelivered" />
        <Section title="Failed" rows={queue.failed} mode="failed" />
        <Section title="Recently handled" rows={queue.recent} mode="recent" />
      </>}
    </main>
  );
}
