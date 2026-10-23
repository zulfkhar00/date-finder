import { requireAdminPage } from "@/lib/admin-auth";
import { inviteLink, loadClients, type TrackerRow } from "@/lib/concierge/operator";
import { safeErrorText } from "@/lib/concierge/telegram";
import { SetupNotice } from "../../_components/notices";
import { ConciergeHeader, ConfigNotices } from "../header";
import { ClientEditForm, InviteForm, NewCodeForm, TrackerForm } from "../ui";
import styles from "../concierge.module.css";

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const num = (value: number | null | undefined) => (value ?? "–");

function Snapshot({ row }: { row: TrackerRow | null }) {
  if (!row) return <span className={styles.meta}>none</span>;
  return <span>{num(row.matches_week)} / {num(row.convos)} / {num(row.dates_scheduled)} <span className={styles.meta}>{day(row.created_at)}</span></span>;
}

export default async function ConciergeClients() {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  let clients: Awaited<ReturnType<typeof loadClients>> = [];
  let loadFailed = false;
  try {
    clients = await loadClients();
  } catch (error) {
    loadFailed = true;
    console.error("Concierge clients load failed", safeErrorText(error));
  }
  return (
    <main className={styles.page}>
      <ConciergeHeader active="clients" />
      <ConfigNotices />
      {loadFailed && <p className={styles.notice}>Couldn&apos;t load clients. Has <code>supabase/2026-10-23-concierge.sql</code> been applied? The server log has the error code.</p>}
      <section className={styles.section}>
        <InviteForm />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Clients <span className={styles.count}>{clients.length}</span></h2>
        {clients.length === 0 ? <p className={styles.empty}>No clients yet. Create an invite above.</p> : <>
          <table className={styles.table}>
            <thead><tr><th>Client</th><th>Status</th><th>Telegram</th><th>Before (matches/wk · convos · dates)</th><th>Latest</th><th>Drafts sent</th></tr></thead>
            <tbody>
              {clients.map((client) => <tr key={client.id}>
                <td><strong>{client.name}</strong><br /><span className={styles.meta}>{client.apps.join(", ") || "no apps set"} · added {day(client.created_at)}</span></td>
                <td>{client.status}</td>
                <td>{client.telegram_chat_id ? <>linked {day(client.linked_at)}</> : client.invite_code ? <>code <code>{client.invite_code}</code><br /><span className={styles.meta}>expires {day(client.invite_expires_at)}</span></> : <span className={styles.meta}>not linked</span>}</td>
                <td><Snapshot row={client.first} /></td>
                <td>{client.snapshots > 1 ? <Snapshot row={client.latest} /> : <span className={styles.meta}>–</span>}</td>
                <td>{client.draftsSent}</td>
              </tr>)}
            </tbody>
          </table>
          {clients.map((client) => <details key={client.id} className={`${styles.card} ${styles.details}`}>
            <summary>{client.name}: edit, tracker, invite</summary>
            <div className={styles.grid}>
              <div className={styles.block}><h4>Profile</h4><ClientEditForm id={client.id} voiceNotes={client.voice_notes} apps={client.apps} status={client.status} /></div>
              <div className={styles.block}><h4>Tracker snapshot</h4><TrackerForm id={client.id} /></div>
            </div>
            {!client.telegram_chat_id && <div className={styles.block}>
              <h4>Invite</h4>
              {client.invite_code && <p className={styles.meta}>Current code <code>{client.invite_code}</code>{inviteLink(client.invite_code) ? <> · <a href={inviteLink(client.invite_code) as string}>{inviteLink(client.invite_code)}</a></> : null}</p>}
              <NewCodeForm id={client.id} />
            </div>}
          </details>)}
        </>}
      </section>
    </main>
  );
}
